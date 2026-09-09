// apps/api/src/modules/auth/auth.service.ts
import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { JwtSignOptions } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { eq, and, isNull } from 'drizzle-orm';
import { randomBytes, createHash } from 'node:crypto';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { tenants, branches, users, refreshTokens } from '../../database/schema';
import type { User, UserRole } from '../../database/schema';
import { UsersService } from '../users/users.service';
import { PasswordService } from './password.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterTenantDto } from './dto/register-tenant.dto';
import type { JwtPayload } from './strategies/jwt.strategy';

interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

// Lo minimo que se necesita para firmar tokens.
interface TokenSubject {
  id: string;
  tenantId: string;
  branchId: string | null;
  role: UserRole;
  email: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly usersService: UsersService,
    private readonly passwords: PasswordService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  // ---------------------------------------------------------------
  // Registro de empresa nueva: tenant + sucursal + owner en una
  // sola transaccion. Si algo falla, no queda nada a medias.
  // ---------------------------------------------------------------
  async registerTenant(dto: RegisterTenantDto, meta: SessionMeta = {}) {
    const [taken] = await this.db.select({ id: tenants.id })
      .from(tenants).where(eq(tenants.slug, dto.slug)).limit(1);

    if (taken) {
      throw new ConflictException(`El identificador "${dto.slug}" ya esta ocupado`);
    }

    const passwordHash = await this.passwords.hash(dto.password);

    const created = await this.db.transaction(async (tx) => {
      const [tenant] = await tx.insert(tenants).values({
        name:      dto.businessName,
        legalName: dto.businessName,
        slug:      dto.slug,
        taxId:     dto.taxId,
        plan:      'basico',
      }).returning();

      const [branch] = await tx.insert(branches).values({
        tenantId: tenant.id,
        code:     'SUC01',
        name:     'Sucursal Principal',
        isMain:   true,
      }).returning();

      const [user] = await tx.insert(users).values({
        tenantId:     tenant.id,
        branchId:     branch.id,
        email:        dto.email,
        passwordHash,
        fullName:     dto.fullName,
        role:         'owner',
      }).returning();

      return { tenant, user };
    });

    this.logger.log(`Empresa creada: ${created.tenant.slug}`);
    return this.issueTokens(created.user, meta);
  }

  // ---------------------------------------------------------------
  // Inicio de sesion.
  // ---------------------------------------------------------------
  async login(dto: LoginDto, meta: SessionMeta = {}) {
    const candidates = await this.usersService.findByEmailGlobal(dto.email);

    // Mensaje deliberadamente vago: no revelamos si el correo existe.
    const generic = 'Correo o contrasena incorrectos';

    // Un correo puede existir en varias empresas. Si hay mas de una
    // coincidencia, el cliente debe indicar cual.
    let account: User | undefined = candidates[0];

    if (candidates.length > 1) {
      if (!dto.tenantSlug) {
        throw new UnauthorizedException(
          'Este correo pertenece a varias empresas. Indica el identificador.',
        );
      }
      const [tenant] = await this.db.select({ id: tenants.id })
        .from(tenants).where(eq(tenants.slug, dto.tenantSlug)).limit(1);

      account = tenant
        ? candidates.find((c) => c.tenantId === tenant.id)
        : undefined;
    }

    if (!account) {
      // Consumimos tiempo similar al de una verificacion real para no
      // filtrar la existencia del usuario por diferencia de latencia.
      await this.passwords.hash(dto.password);
      throw new UnauthorizedException(generic);
    }

    const valid = await this.passwords.verify(account.passwordHash, dto.password);
    if (!valid) throw new UnauthorizedException(generic);

    if (!account.isActive) {
      throw new UnauthorizedException('Tu cuenta esta desactivada');
    }

    // Si el hash quedo con parametros antiguos, lo actualizamos.
    if (this.passwords.needsRehash(account.passwordHash)) {
      const fresh = await this.passwords.hash(dto.password);
      await this.usersService.updatePasswordHash(account.tenantId, account.id, fresh);
    }

    await this.usersService.touchLastLogin(account.tenantId, account.id);
    return this.issueTokens(account, meta);
  }

  // ---------------------------------------------------------------
  // Rotacion de refresh token: el viejo se revoca al usarse.
  // ---------------------------------------------------------------
  async refresh(rawToken: string, meta: SessionMeta = {}) {
    const tokenHash = this.hashToken(rawToken);

    const [record] = await this.db.select().from(refreshTokens)
      .where(and(eq(refreshTokens.tokenHash, tokenHash), isNull(refreshTokens.revokedAt)))
      .limit(1);

    if (!record || record.expiresAt < new Date()) {
      throw new UnauthorizedException('Sesion expirada, inicia sesion de nuevo');
    }

    const user = await this.usersService.findActiveById(record.tenantId, record.userId);
    if (!user) throw new UnauthorizedException('La cuenta ya no esta disponible');

    await this.db.update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.id, record.id));

    return this.issueTokens(user, meta);
  }

  async logout(rawToken: string) {
    await this.db.update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.tokenHash, this.hashToken(rawToken)));
    return { message: 'Sesion cerrada' };
  }

  async me(tenantId: string, userId: string) {
    const user = await this.usersService.findActiveById(tenantId, userId);
    if (!user) throw new UnauthorizedException();

    const [tenant] = await this.db.select({
      id: tenants.id, name: tenants.name, slug: tenants.slug, plan: tenants.plan,
    }).from(tenants).where(eq(tenants.id, tenantId)).limit(1);

    return {
      user: {
        id: user.id, email: user.email, fullName: user.fullName,
        role: user.role, branchId: user.branchId,
      },
      tenant,
    };
  }

  // ---------------------------------------------------------------
  // Internos
  // ---------------------------------------------------------------
  private async issueTokens(user: TokenSubject, meta: SessionMeta) {
    const payload: JwtPayload = {
      sub:      user.id,
      tenantId: user.tenantId,
      branchId: user.branchId,
      role:     user.role,
      email:    user.email,
    };

    // El "as JwtSignOptions" es necesario: jsonwebtoken exige que
    // expiresIn sea StringValue ('15m', '7d'), y una variable de
    // entorno siempre llega como string generico.
    const signOptions = {
      expiresIn: this.config.get<string>('JWT_ACCESS_EXPIRES') ?? '15m',
    } as JwtSignOptions;

    const accessToken = await this.jwt.signAsync(payload, signOptions);

    const rawRefresh = randomBytes(48).toString('base64url');
    const days = Number(this.config.get<string>('JWT_REFRESH_DAYS') ?? 7);
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.db.insert(refreshTokens).values({
      tenantId:  user.tenantId,
      userId:    user.id,
      tokenHash: this.hashToken(rawRefresh),
      userAgent: meta.userAgent?.slice(0, 255),
      ipAddress: meta.ip?.slice(0, 45),
      expiresAt,
    });

    return {
      accessToken,
      refreshToken: rawRefresh,
      user: {
        id: user.id, email: user.email, role: user.role,
        tenantId: user.tenantId, branchId: user.branchId,
      },
    };
  }

  // El refresh token se guarda hasheado: si alguien lee la tabla,
  // no obtiene tokens usables.
  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }
}

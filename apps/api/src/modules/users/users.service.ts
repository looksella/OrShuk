// apps/api/src/modules/users/users.service.ts
// NOTA: DrizzleDB se importa con "import type" porque se usa en un
// constructor decorado. Con isolatedModules + emitDecoratorMetadata,
// TypeScript exige esa forma para los tipos de parametros.
import { Inject, Injectable } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import { DRIZZLE } from '../../database/database.module';
import type { DrizzleDB } from '../../database/database.module';
import { users } from '../../database/schema';
import type { NewUser, User } from '../../database/schema';

@Injectable()
export class UsersService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  // Unica consulta que busca por email sin tenantId: en el login
  // todavia no se conoce la empresa.
  async findByEmailGlobal(email: string): Promise<User[]> {
    return this.db.select().from(users).where(eq(users.email, email));
  }

  async findByEmailInTenant(tenantId: string, email: string): Promise<User | undefined> {
    const [row] = await this.db.select().from(users)
      .where(and(eq(users.tenantId, tenantId), eq(users.email, email)))
      .limit(1);
    return row;
  }

  async findActiveById(tenantId: string, userId: string): Promise<User | undefined> {
    const [row] = await this.db.select().from(users)
      .where(and(
        eq(users.tenantId, tenantId),
        eq(users.id, userId),
        eq(users.isActive, true),
      ))
      .limit(1);
    return row;
  }

  async create(data: NewUser): Promise<User> {
    const [row] = await this.db.insert(users).values(data).returning();
    return row;
  }

  async updatePasswordHash(tenantId: string, userId: string, hash: string): Promise<void> {
    await this.db.update(users)
      .set({ passwordHash: hash })
      .where(and(eq(users.tenantId, tenantId), eq(users.id, userId)));
  }

  async touchLastLogin(tenantId: string, userId: string): Promise<void> {
    await this.db.update(users)
      .set({ lastLoginAt: new Date() })
      .where(and(eq(users.tenantId, tenantId), eq(users.id, userId)));
  }
}

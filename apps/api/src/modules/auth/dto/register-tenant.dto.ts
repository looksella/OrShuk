// apps/api/src/modules/auth/dto/register-tenant.dto.ts
import { IsEmail, IsString, MinLength, MaxLength, Matches, IsOptional } from 'class-validator';

export class RegisterTenantDto {
  @IsString()
  @MinLength(3,   { message: 'El nombre del negocio es muy corto' })
  @MaxLength(160)
  businessName: string;

  @IsString()
  @MinLength(3)
  @MaxLength(60)
  @Matches(/^[a-z0-9-]+$/, {
    message: 'El identificador solo admite minusculas, numeros y guiones',
  })
  slug: string;

  @IsString()
  @MinLength(3)
  @MaxLength(160)
  fullName: string;

  @IsEmail({}, { message: 'El correo no tiene un formato valido' })
  email: string;

  @IsString()
  @MinLength(8,  { message: 'La contrasena debe tener al menos 8 caracteres' })
  @MaxLength(72, { message: 'La contrasena no puede exceder 72 caracteres' })
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  taxId?: string;
}

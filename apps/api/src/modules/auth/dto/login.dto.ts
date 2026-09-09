// apps/api/src/modules/auth/dto/login.dto.ts
import { IsEmail, IsString, MinLength, MaxLength, IsOptional } from 'class-validator';

export class LoginDto {
  @IsEmail({}, { message: 'El correo no tiene un formato valido' })
  email: string;

  @IsString()
  @MinLength(8,  { message: 'La contrasena debe tener al menos 8 caracteres' })
  @MaxLength(72, { message: 'La contrasena no puede exceder 72 caracteres' })
  password: string;

  @IsOptional()
  @IsString()
  tenantSlug?: string;
}

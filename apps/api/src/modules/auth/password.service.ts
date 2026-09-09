// apps/api/src/modules/auth/password.service.ts
// Argon2id, perfil OWASP: m=64MiB, t=3, p=1.
//
// NOTA SOBRE TIPOS: argon2 0.45 ya no exporta el tipo "Options".
// Se declara el objeto sin anotacion y con "as const" para que
// TypeScript elija la sobrecarga que devuelve string, no Buffer.
import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';

const HASH_OPTIONS = {
  type:        argon2.argon2id,
  memoryCost:  65536, // 64 MiB
  timeCost:    3,
  parallelism: 1,
  hashLength:  32,
} as const;

@Injectable()
export class PasswordService {
  private readonly logger = new Logger(PasswordService.name);

  async hash(plain: string): Promise<string> {
    return argon2.hash(plain, HASH_OPTIONS) as Promise<string>;
  }

  async verify(hash: string, plain: string): Promise<boolean> {
    try {
      return await argon2.verify(hash, plain);
    } catch (err) {
      this.logger.warn(`Hash con formato invalido: ${(err as Error).message}`);
      return false;
    }
  }

  // true si el hash guardado usa parametros mas debiles que los actuales.
  needsRehash(hash: string): boolean {
    try {
      return argon2.needsRehash(hash, HASH_OPTIONS);
    } catch {
      return false;
    }
  }
}

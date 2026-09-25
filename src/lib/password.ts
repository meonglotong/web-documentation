import { hash, verify, argon2id } from "@node-rs/argon2";

export function hashPassword(plain: string): Promise<string> {
  return hash(plain, { type: argon2id, memoryCost: 19456, parallelism: 2, hashLength: 32 });
}

export function verifyPassword(stored: string, plain: string): Promise<boolean> {
  return verify(stored, plain, { type: argon2id });
}

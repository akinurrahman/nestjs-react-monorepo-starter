import { randomBytes } from 'node:crypto';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { hashPassword, verifyPassword } from './password.js';

@Injectable()
export class PasswordService implements OnModuleInit {
  private dummyHash: string | undefined;

  // Made at boot, so a Node build without argon2 (linked against an OpenSSL
  // older than 3.2) fails at startup rather than on the first login.
  async onModuleInit(): Promise<void> {
    this.dummyHash = await hashPassword(randomBytes(32).toString('base64url'));
  }

  hash(password: string): Promise<string> {
    return hashPassword(password);
  }

  verify(stored: string, password: string): Promise<boolean> {
    return verifyPassword(stored, password);
  }

  // Burns the same time as a real check, for logins with an unknown email:
  // without it, how fast the 401 comes back tells which emails exist.
  async verifyDummy(password: string): Promise<void> {
    this.dummyHash ??= await hashPassword(
      randomBytes(32).toString('base64url'),
    );
    await verifyPassword(this.dummyHash, password);
  }
}

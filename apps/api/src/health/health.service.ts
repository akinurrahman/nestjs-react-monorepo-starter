import { Injectable } from '@nestjs/common';
import type { Health, Readiness } from '@starter/shared';
import { ServiceUnavailableError } from '../common/errors/index.js';
import { HealthRepository } from './health.repository.js';

export const DATABASE_PING_TIMEOUT_MS = 2000;

@Injectable()
export class HealthService {
  constructor(private readonly health: HealthRepository) {}

  // Liveness: the process is up and serving requests. Touches no dependency,
  // so a database outage never gets the app restarted.
  liveness(): Health {
    return { status: 'ok' };
  }

  async readiness(): Promise<Readiness> {
    try {
      await withTimeout(this.health.ping(), DATABASE_PING_TIMEOUT_MS);
    } catch (cause) {
      throw new ServiceUnavailableError(undefined, undefined, { cause });
    }
    return { status: 'ok', checks: { database: 'ok' } };
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

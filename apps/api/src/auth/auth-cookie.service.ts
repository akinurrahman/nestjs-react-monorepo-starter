import { Injectable } from '@nestjs/common';
import type { CookieSerializeOptions } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpAdapterHost } from '@nestjs/core';
import type { Response } from 'express';
import type { Env } from '../config/env.schema.js';
import { API_PREFIX } from '../config/http.config.js';

// The refresh cookie is only ever sent to the auth routes.
export const AUTH_COOKIE_PATH = `/${API_PREFIX}/auth`;

// Reads and writes the refresh token cookie. Secure is always on: browsers
// accept Secure cookies on http://localhost, so dev works without TLS.
@Injectable()
export class AuthCookieService {
  private readonly name: string;
  private readonly options: CookieSerializeOptions;

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    config: ConfigService<Env, true>,
  ) {
    this.name = config.get('AUTH_COOKIE_NAME', { infer: true });
    const domain = config.get('AUTH_COOKIE_DOMAIN', { infer: true });
    this.options = {
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: AUTH_COOKIE_PATH,
      ...(domain !== undefined && { domain }),
      // Seconds. Refreshing slides it along with the session.
      maxAge: config.get('AUTH_REFRESH_TTL', { infer: true }),
    };
  }

  read(cookies: Record<string, string | undefined>): string | undefined {
    return cookies[this.name];
  }

  set(res: Response, token: string): void {
    this.adapterHost.httpAdapter.setCookie(res, this.name, token, this.options);
  }

  clear(res: Response): void {
    const { maxAge: _maxAge, ...options } = this.options;
    this.adapterHost.httpAdapter.clearCookie(res, this.name, options);
  }
}

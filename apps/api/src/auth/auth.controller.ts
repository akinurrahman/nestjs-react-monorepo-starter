import {
  Body,
  Controller,
  Cookies,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthResponse, PublicUser } from '@starter/shared';
import type { Request, Response } from 'express';
import { ApiDataResponse, ApiErrorResponses } from '../common/swagger/index.js';
import { LOGIN_RATE_LIMIT, loginTracker } from '../config/throttler.config.js';
import { PublicUserDto } from '../users/users.dto.js';
import { AuthCookieService } from './auth-cookie.service.js';
import { CurrentUser, Public } from './auth.decorators.js';
import { AuthResponseDto, ChangePasswordDto, LoginDto } from './auth.dto.js';
import { AuthService, type AuthResult } from './auth.service.js';
import { PasswordChangeThrottlerGuard } from './password-change-throttler.guard.js';
import type { AuthUser, ClientInfo } from './auth.types.js';

const USER_AGENT_MAX = 512;

// req.ip honours TRUST_PROXY, so behind a proxy it is the client's address.
function clientInfo(req: Request): ClientInfo {
  return {
    ip: req.ip,
    userAgent: req.headers['user-agent']?.slice(0, USER_AGENT_MAX),
  };
}

type CookieJar = Record<string, string | undefined>;

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly cookies: AuthCookieService,
  ) {}

  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { ...LOGIN_RATE_LIMIT, getTracker: loginTracker } })
  @ApiDataResponse(AuthResponseDto, {
    description: 'Logged in. Sets the refresh token cookie.',
  })
  @ApiErrorResponses(400, 401, 403, 429)
  async login(
    @Body() body: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    return this.respond(res, await this.auth.login(body, clientInfo(req)));
  }

  @Post('refresh')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiDataResponse(AuthResponseDto, {
    description:
      'New access token. Rotates the refresh token cookie, except for a repeat within the grace window.',
  })
  @ApiErrorResponses(401, 403, 429)
  async refresh(
    @Cookies() cookies: CookieJar,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponse> {
    const result = await this.auth.refresh(
      this.cookies.read(cookies),
      clientInfo(req),
    );
    return this.respond(res, result);
  }

  // Public so it works once the access token has expired. Succeeds with no
  // cookie or a bad one.
  @Post('logout')
  @Public()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description: 'Session revoked and cookie cleared.',
  })
  @ApiErrorResponses(403, 429)
  async logout(
    @Cookies() cookies: CookieJar,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    await this.auth.logout(this.cookies.read(cookies));
    this.cookies.clear(res);
  }

  @Get('me')
  @ApiDataResponse(PublicUserDto)
  @ApiErrorResponses(401, 429)
  me(@CurrentUser() user: AuthUser): Promise<PublicUser> {
    return this.auth.me(user.id);
  }

  @Post('password')
  @UseGuards(PasswordChangeThrottlerGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description:
      'Password changed. Revokes every other session of the user; this one stays.',
  })
  @ApiErrorResponses(400, 401, 403, 429)
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() body: ChangePasswordDto,
  ): Promise<void> {
    return this.auth.changePassword(user, body);
  }

  private respond(res: Response, result: AuthResult): AuthResponse {
    if (result.refreshToken) this.cookies.set(res, result.refreshToken);
    return { accessToken: result.accessToken, user: result.user };
  }
}

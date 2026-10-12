import { Body, Controller, Patch } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { PublicUser } from '@starter/shared';
import { CurrentUser } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import { ApiDataResponse, ApiErrorResponses } from '../common/swagger/index.js';
import { PublicUserDto, UpdateMeDto } from './users.dto.js';
import { UsersService } from './users.service.js';

// The caller's own profile, for any logged-in user. Must be registered
// before UsersController: Express matches routes in order, and /users/:id
// would otherwise take /users/me.
@ApiTags('users')
@Controller('users/me')
export class UsersMeController {
  constructor(private readonly users: UsersService) {}

  @Patch()
  @ApiDataResponse(PublicUserDto)
  // 403 is the CSRF check, which rejects cross-site writes.
  @ApiErrorResponses(400, 401, 403, 429)
  update(
    @CurrentUser() actor: AuthUser,
    @Body() body: UpdateMeDto,
  ): Promise<PublicUser> {
    return this.users.updateMe(actor, body);
  }
}

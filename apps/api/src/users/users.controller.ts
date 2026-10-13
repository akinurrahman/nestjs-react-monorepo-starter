import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiNoContentResponse, ApiTags } from '@nestjs/swagger';
import type { PublicUser } from '@starter/shared';
import { CurrentUser, Roles } from '../auth/auth.decorators.js';
import type { AuthUser } from '../auth/auth.types.js';
import type { PaginatedResult } from '../common/pagination/index.js';
import {
  ApiDataResponse,
  ApiErrorResponses,
  ApiPaginatedResponse,
} from '../common/swagger/index.js';
import {
  CreateUserDto,
  ListUsersQueryDto,
  PublicUserDto,
  SetPasswordDto,
  UpdateUserDto,
  UserIdParamDto,
} from './users.dto.js';
import { UsersService } from './users.service.js';

// Admin only, at the class, so a route added here later is admin too. The
// caller's own routes live in UsersMeController, registered first so
// /users/me never reaches /users/:id.
@ApiTags('users')
@Roles('ADMIN')
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiPaginatedResponse(PublicUserDto)
  @ApiErrorResponses(400, 401, 403, 429)
  list(
    @Query() query: ListUsersQueryDto,
  ): Promise<PaginatedResult<PublicUser>> {
    return this.users.list(query);
  }

  @Get(':id')
  @ApiDataResponse(PublicUserDto)
  @ApiErrorResponses(400, 401, 403, 404, 429)
  findOne(@Param() { id }: UserIdParamDto): Promise<PublicUser> {
    return this.users.findOne(id);
  }

  @Post()
  @ApiDataResponse(PublicUserDto, { status: HttpStatus.CREATED })
  @ApiErrorResponses(400, 401, 403, 409, 429)
  create(@Body() body: CreateUserDto): Promise<PublicUser> {
    return this.users.create(body);
  }

  @Patch(':id')
  @ApiDataResponse(PublicUserDto, {
    description: 'Updated. A role change revokes all sessions of the user.',
  })
  @ApiErrorResponses(400, 401, 403, 404, 409, 429)
  update(
    @CurrentUser() actor: AuthUser,
    @Param() { id }: UserIdParamDto,
    @Body() body: UpdateUserDto,
  ): Promise<PublicUser> {
    return this.users.update(actor, id, body);
  }

  @Post(':id/disable')
  @HttpCode(HttpStatus.OK)
  @ApiDataResponse(PublicUserDto, {
    description: 'Disabled. Revokes all sessions of the user.',
  })
  @ApiErrorResponses(400, 401, 403, 404, 409, 429)
  disable(
    @CurrentUser() actor: AuthUser,
    @Param() { id }: UserIdParamDto,
  ): Promise<PublicUser> {
    return this.users.disable(actor, id);
  }

  @Post(':id/enable')
  @HttpCode(HttpStatus.OK)
  @ApiDataResponse(PublicUserDto)
  @ApiErrorResponses(400, 401, 403, 404, 429)
  enable(@Param() { id }: UserIdParamDto): Promise<PublicUser> {
    return this.users.enable(id);
  }

  @Post(':id/password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse({
    description:
      'Password set. Revokes all sessions of the user. Not for the caller, who uses POST /auth/password.',
  })
  @ApiErrorResponses(400, 401, 403, 404, 429)
  setPassword(
    @CurrentUser() actor: AuthUser,
    @Param() { id }: UserIdParamDto,
    @Body() body: SetPasswordDto,
  ): Promise<void> {
    return this.users.setPassword(actor, id, body.password);
  }
}

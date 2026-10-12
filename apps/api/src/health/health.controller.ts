import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import type { Health, Readiness } from '@starter/shared';
import { ApiDataResponse, ApiErrorResponses } from '../common/swagger/index.js';
import { HealthDto, ReadinessDto } from './health.dto.js';
import { HealthService } from './health.service.js';

// Probes poll on a fixed schedule; throttling them could fail a healthy pod.
// Only the probes skip it: /api/health/status is an ordinary app route.
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  @Get()
  @SkipThrottle()
  @ApiDataResponse(HealthDto)
  liveness(): Health {
    return this.health.liveness();
  }

  @Get('ready')
  @SkipThrottle()
  @ApiDataResponse(ReadinessDto)
  @ApiErrorResponses(503)
  readiness(): Promise<Readiness> {
    return this.health.readiness();
  }

  // The readiness check under the /api prefix, for the web app. The probe
  // paths stay unprefixed for infra.
  @Get('status')
  @ApiDataResponse(ReadinessDto)
  @ApiErrorResponses(503)
  status(): Promise<Readiness> {
    return this.health.readiness();
  }
}

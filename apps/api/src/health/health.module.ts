import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { HealthRepository } from './health.repository.js';
import { HealthService } from './health.service.js';

@Module({
  controllers: [HealthController],
  providers: [HealthRepository, HealthService],
})
export class HealthModule {}

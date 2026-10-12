import { healthSchema, readinessSchema } from '@starter/shared';
import { createZodDto } from 'nestjs-zod';

export class HealthDto extends createZodDto(healthSchema) {}

export class ReadinessDto extends createZodDto(readinessSchema) {}

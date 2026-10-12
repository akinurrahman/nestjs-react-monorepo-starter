export const HEALTH_KEYS = {
  all: ['health'] as const,
  status: () => [...HEALTH_KEYS.all, 'status'] as const,
};

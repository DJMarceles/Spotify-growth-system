/**
 * Redis client configuration scaffold.
 * Uncomment and configure when Redis is available.
 */

export interface RedisConfig {
  url: string;
  token?: string;
}

export function getRedisConfig(): RedisConfig {
  return {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  };
}

// Redis client will be initialized here when the dependency is added.
// For MVP, we'll use Upstash Redis or ioredis depending on deployment target.

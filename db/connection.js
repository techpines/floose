import Redis from 'ioredis'

const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379'

// Create the Redis client instance
const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  connectTimeout: 10000 // 10 seconds timeout
})

export default redis
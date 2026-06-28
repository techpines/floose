import Redis from 'ioredis'
import {config} from '#config/index.js'

const redisUrl = config.redis_url

// Create the Redis client instance
const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
  connectTimeout: 10000 // 10 seconds timeout
})

export default redis
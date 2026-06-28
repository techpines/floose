
import {z} from 'zod'

const runtimeSchema = z.object({
  mode: z.enum(['worker', 'socket'])
})

const runtime = runtimeSchema.parse({mode: process.argv[2]})

const envSchema = z.object({
  APP_ENV: z.enum(['development', 'production', 'test']).default('development'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  REDIS_URL: z.string()
})

const env = envSchema.parse(process.env)

// Look familiar? You get your clean, quiet, nested JSON-like structure:
export const config = {
  runtime: {
    mode: runtime.mode,
    app_env: env.APP_ENV,
    node_env: env.NODE_ENV
  },
  redis: {
    url: env.REDIS_URL
  }
}
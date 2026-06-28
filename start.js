import * as modes from '#runtime/index.js'
import logger from '#util/logger.js'
import {AppError} from '#util/errors.js'

const target = process.argv[2] || null
const runtime = modes[target]

logger.info('process-starting', {argv: process.argv, runtime: target})

if (!runtime) {
  const error = AppError('invalid-runtime', {argv: process.argv, runtime: target})
  logger.error('startup-failed', error)
  throw error
}

await runtime()
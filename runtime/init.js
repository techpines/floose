
import {logger} from '#util/logger.js'

logger.info('process-init', {argv: process.argv})

process.on('uncaughtException', (err) => {
  logger.fatal('uncaught-exception', err)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  const error = reason instanceof Error ? reason : new Error(String(reason))
  logger.fatal('unhandled-rejection', error)
  process.exit(1)
})

process.on('warning', (warning) => {
  logger.warn('node-process-warning', {
    name: warning.name,
    message: warning.message,
    stack: warning.stack
  })
})
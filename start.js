
import '#runtime/init.js'
import {config} from '#config/index.js'
import {logger} from '#util/logger.js'
import * as modes from '#runtime/index.js'

const target = process.argv[2] || null
const runtime = modes[target]

logger.info('config', {config})

await runtime()
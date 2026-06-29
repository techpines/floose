
import '#runtime/init.js'
import {config} from '#config/index.js'
import {logger} from '#util/logger.js'
import * as modes from '#runtime/index.js'

const runtime = modes[config.runtime.mode]

logger.info('config', {config})

await runtime()

import {defineConfig} from 'eslint/config'
import {ignore, styles, exceptions, logger} from '#eslint/index.js'

export default defineConfig([
  ignore, styles, exceptions, logger
])
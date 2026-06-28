import * as modes from '#runtime/index.js'

const target = process.argv[2] || process.env.RUNTIME
const runtime = modes[target]

if (!runtime) {
  throw new Error(`Invalid runtime target: "${target}"`)
}

await runtime()
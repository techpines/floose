import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  messageKey: 'code',
  base: null,
  // Redact sensitive data before it hits CloudWatch
  redact: ['req.headers.authorization', 'password', 'body.credit_card'],
  formatters: {
    level(label, number) {
      return {level: label}
    }
  },
  serializers: {
    err(err) {
      return {
        type: err.name && err.name !== 'Object' ? err.name : 'AppError',
        message: err.message,
        stack: err.stack,
        code: err.code || undefined,
        ...(err.data || {}), // Unpacks your AppError payload object
        ...err,               // Captures any flat properties (like argv or runtime),
        name: undefined,
        data: undefined
      }
    }
  },

  hooks: {
    logMethod(inputArgs, method) {
      const [code, data] = inputArgs

      // 2. Direct error logging (e.g., logger.error(err))
      if (code instanceof Error || (code && typeof code === 'object' && code.stack)) {
        return method.call(this, {
          code: code.code || code.message || 'unhandled-exception',
          err: code // Pass the raw error object directly
        })
      }

      // 3. Your preferred event logging style (e.g., logger.error('code', err))
      if (typeof code === 'string') {
        const payload = {code}

        if (data instanceof Error || (data && typeof data === 'object' && data.stack)) {
          payload.err = data // Pass the raw error object directly
        } else if (data && typeof data === 'object') {
          Object.assign(payload, data)
        }

        return method.call(this, payload)
      }

      return method.apply(this, inputArgs)
    }
  }
})

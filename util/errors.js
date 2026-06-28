class BaseAppError extends Error {
  constructor(code, data = {}) {
    super(code)
    this.name = 'AppError'
    this.code = code
    this.data = data

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}

// The magic trick: A Proxy that intercepts normal function calls
// and automatically executes them with 'new' behind the scenes.
export const AppError = (code, data) => new BaseAppError(code, data)
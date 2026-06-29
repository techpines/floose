
export default {
  plugins: {
    local: {
      rules: {
        'strict-logger': {
          meta: {
            type: 'problem',
            docs: {description: 'Enforce event-driven logging signature: logger.info("kebab-case-code", data)'}
          },
          create(context) {
            // Strict hyphen-case regex (lowercase words separated by single hyphens)
            const KEBAB_CASE_REGEX = /^[a-z0-9]+(-[a-z0-9]+)*$/

            return {
              'CallExpression[callee.object.name=\'logger\'][callee.property.name=/^(trace|debug|info|warn|error|fatal)$/]' (node) {
                const args = node.arguments

                if (args.length === 0) {
                  context.report({node, message: 'Logger requires at least a string code argument.'})
                  return
                }

                const firstArg = args[0]
                const isPlainString = firstArg.type === 'Literal' && typeof firstArg.value === 'string'
                const isCleanTemplate = firstArg.type === 'TemplateLiteral' && firstArg.expressions.length === 0

                if (!isPlainString && !isCleanTemplate) {
                  context.report({
                    node: firstArg,
                    message: 'The first argument to the logger must be a strict string literal log code.'
                  })
                  return
                }
                const stringValue = isPlainString ? firstArg.value : firstArg.quals[0].value.cooked

                if (!KEBAB_CASE_REGEX.test(stringValue)) {
                  context.report({
                    node: firstArg,
                    message: `Log code "${stringValue}" must be strict hyphen-case (lowercase, alphanumeric, separated by hyphens). e.g., 'user-updated'`
                  })
                }

                if (args.length > 2) {
                  context.report({node, message: 'Logger only accepts a maximum of 2 arguments.'})
                }
              }
            }
          }
        }
      }
    }
  },
  rules: {
    'local/strict-logger': 'error'
  }
}
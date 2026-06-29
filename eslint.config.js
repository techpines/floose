import js from '@eslint/js'
import globals from 'globals'
import stylistic from '@stylistic/eslint-plugin'
import nodePlugin from 'eslint-plugin-n'
import {defineConfig} from 'eslint/config'

export default defineConfig([{
  // Global ignores
  ignores: ['node_modules/']
}, {
  files: ['**/*.js'],

  plugins: {
    '@stylistic': stylistic,
    'n': nodePlugin
  },

  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    globals: {
      ...globals.node
    }
  },

  rules: {
    // Core recommended rules
    ...js.configs.recommended.rules,

    // Modern Node.js safety rules
    ...nodePlugin.configs['flat/recommended-module'].rules,

    // 3. Modern stylistic rules
    '@stylistic/indent': ['error', 2, {
      VariableDeclarator: {var: 2, let: 2, const: 3}
    }],
    '@stylistic/linebreak-style': ['error', 'unix'],
    '@stylistic/quotes': ['error', 'single'],
    '@stylistic/semi': ['error', 'never'],
    '@stylistic/object-curly-spacing': ['error', 'never'],
    '@stylistic/no-multiple-empty-lines': ['error', {max: 1}],
    '@stylistic/no-trailing-spaces': 'error',
    '@stylistic/comma-dangle': ['error', 'never'],

    // Logic & code quality overrides
    'one-var': 0,
    'no-console': ['error', {allow: ['warn', 'error']}],
    'no-unused-vars': ['error', {args: 'none', varsIgnorePattern: '[iI]gnore'}],
    'no-shadow': ['error', {allow: ['done', 'next', 'err']}],

    // Node strictly requires file extensions on relative imports
    'n/file-extension-in-import': ['error', 'always']
  }
}, {
  files: ['eslint.config.js'],
  rules: {
    'n/no-unpublished-import': 'off'
  }
}, {
  files: ['runtime/init.js'],
  rules: {
    'n/no-process-exit': 'off'
  }
}, {
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
}])
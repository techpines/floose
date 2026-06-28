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
  // Special exception for config files so they can safely use devDependencies
  files: ['eslint.config.js'],
  rules: {
    'n/no-unpublished-import': 'off'
  }
}])
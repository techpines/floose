import js from '@eslint/js'
import globals from 'globals'

export default [{
  // Global ignores
  ignores: []
},
{
  // Main config
  // plugins: {
  //   '@stylistic': stylistic
  // },
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    globals: globals.node
  },

  rules: {
    ...js.configs.recommended.rules,

    'indent': ['error', 2, {
      VariableDeclarator: {
        var: 2,
        let: 2,
        const: 3
      }
    }],

    'linebreak-style': ['error', 'unix'],
    'quotes': ['error', 'single'],
    'semi': ['error', 'never'],
    'one-var': 0,
    'no-buffer-constructor': 'error',

    'no-console': ['error', {
      allow: ['warn', 'error']
    }],

    'no-unused-vars': ['error', {
      args: 'none',
      varsIgnorePattern: '[iI]gnore'
    }],

    'no-shadow': ['error', {
      allow: ['done', 'next', 'err']
    }],

    'object-curly-spacing': ['error', 'never'],

    'no-multiple-empty-lines': ['error', {
      max: 1
    }],

    'no-irregular-whitespace': [2],
    'no-trailing-spaces': [2],
    'comma-dangle': ['error', 'never']
  }
}
]

export default [{
  files: ['eslint.config.js'],
  rules: {
    'n/no-unpublished-import': 'off'
  }
}, {
  files: ['runtime/init.js'],
  rules: {
    'n/no-process-exit': 'off'
  }
}]
import baseConfig from '../../base-eslint.config.mjs'

export default [
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'import/extensions': ['error', 'always', { ignorePackages: true }],
      'no-console': 'error',
    },
  },
]

import eslintImport from 'eslint-plugin-import'
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended'
import unusedImports from 'eslint-plugin-unused-imports'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default [
  eslintPluginPrettierRecommended,
  ...tseslint.configs.recommended,
  {
    plugins: {
      'unused-imports': unusedImports,
      import: eslintImport,
    },
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'prettier/prettier': 'warn',
      'no-useless-catch': 'warn',
      'func-names': 'off',
      'arrow-parens': ['error', 'always'],
      semi: ['error', 'never'],
      'no-multiple-empty-lines': [
        'error',
        {
          max: 1,
        },
      ],
      quotes: ['error', 'single', { avoidEscape: true }],
      'no-await-in-loop': 'off',
      'no-underscore-dangle': ['warn', { allow: ['_id', '__v'] }],
      'prefer-destructuring': 'warn',
      'no-use-before-define': 'off',
      'no-param-reassign': [
        'error',
        { ignorePropertyModificationsFor: ['state', 'acc'] },
      ],
      'no-return-await': 'warn',
      'no-return-assign': 'warn',
      curly: ['error', 'all'],
      'class-methods-use-this': 'off',
      'unused-imports/no-unused-imports': 'error',
      eqeqeq: ['error', 'always'],
      'id-length': [
        'warn',
        { min: 2, exceptions: ['a', 'b', 'i', 'j', '_'], properties: 'never' },
      ],
      'import/no-duplicates': 'error',
      'import/named': 'error',
      'import/prefer-default-export': 'off',
      'import/no-cycle': ['warn'],
      'import/no-extraneous-dependencies': 'off',
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ClassDeclaration',
          message: 'Classes are not allowed. Use functions and closures.',
        },
      ],

      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          args: 'all',
          argsIgnorePattern: '^_',
          caughtErrors: 'all',
          caughtErrorsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          ignoreRestSiblings: true,
        },
      ],
    },
  },
]

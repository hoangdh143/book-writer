import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import functional from 'eslint-plugin-functional'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    plugins: {
      functional,
      'react-hooks': reactHooks,
    },
    rules: {
      // hooks discipline
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // declarative style: no mutable locals, no in-place mutation, no loops
      'functional/immutable-data': ['error', { ignoreClasses: true, ignoreImmediateMutation: true }],
      'functional/no-let': 'error',
      'functional/no-loop-statements': 'error',
      'functional/no-throw': 'off',
      'functional/no-method-signature': 'off',

      // budget against monster functions/files
      'max-lines-per-function': ['error', { max: 70, skipBlankLines: true, skipComments: true }],
      'max-lines': ['error', { max: 240, skipBlankLines: true, skipComments: true }],
      'max-statements': ['error', 25],
      'complexity': ['error', { max: 16 }],
      'max-depth': ['error', 3],
      'max-params': ['error', 4],

      'no-var': 'error',
      'prefer-const': 'error',
      'object-shorthand': 'error',
      'prefer-template': 'error',
      'arrow-body-style': ['error', 'as-needed'],
      '@typescript-eslint/no-confusing-void-expression': [
        'error',
        { ignoreArrowShorthand: true, ignoreVoidOperator: true },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  // tooling files live outside the tsconfig project
  {
    files: ['*.config.js', 'vite.config.ts'],
    ...tseslint.configs.disableTypeChecked,
  },
)

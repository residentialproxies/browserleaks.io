import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const vitestGlobals = {
  describe: 'readonly',
  it: 'readonly',
  expect: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
  vi: 'readonly',
};

export default tseslint.config(
  {
    ignores: ['dist/**', '.turbo/**', 'coverage/**', 'node_modules/**'],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        project: false,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-namespace': ['warn', { allowDeclarations: true }],
      'no-console': 'warn',
    },
  },
  {
    files: ['src/**/*.test.ts', 'src/**/__tests__/**/*.ts'],
    languageOptions: {
      globals: vitestGlobals,
    },
  }
);

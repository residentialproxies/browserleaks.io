import nextConfig from 'eslint-config-next';

const [nextBase, nextTsConfig, nextIgnores] = nextConfig;

const vitestGlobals = {
  describe: 'readonly',
  it: 'readonly',
  expect: 'readonly',
  beforeEach: 'readonly',
  afterEach: 'readonly',
  vi: 'readonly',
};

const tsWithProject = {
  ...nextTsConfig,
  languageOptions: {
    ...nextTsConfig.languageOptions,
  },
};

export default [
  {
    ignores: ['.next/**', '.open-next/**', '.turbo/**', 'coverage/**', 'dist/**', 'node_modules/**'],
  },
  nextBase,
  tsWithProject,
  nextIgnores,
  {
    files: ['**/*.{js,jsx,ts,tsx,mjs}'],
    rules: {
      'react/no-unescaped-entities': 'off',
      // Relax overly strict React 19 defaults for our current codebase
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/purity': 'off',
      'react-hooks/immutability': 'off',
      'react-hooks/exhaustive-deps': 'warn',
      'import/no-anonymous-default-export': 'off',
    },
  },
  {
    files: ['tests/**/*.{ts,tsx}', '**/__tests__/**/*.{ts,tsx}'],
    languageOptions: {
      globals: vitestGlobals,
    },
  },
];

/**
 * ESLint flat configuration.
 *
 * Purpose: catch the mistakes that a build does not — unused bindings, broken
 *          hook dependency arrays, components that break fast refresh.
 * Inputs:  src/**\/*.{js,jsx}
 * Outputs: lint diagnostics
 * Deps:    @eslint/js, eslint-plugin-react-hooks, eslint-plugin-react-refresh
 */
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';

export default [
  { ignores: ['dist'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // Constants exported next to a component are intentional throughout this
      // codebase (variant maps, descriptors); only warn.
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
];

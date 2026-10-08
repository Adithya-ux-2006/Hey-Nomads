import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  {
    ignores: ['dist'],
  },
  {
    files: ['**/*.{js,jsx}'],
    ...js.configs.recommended,
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    settings: {
      react: { version: 'detect' },
    },
    rules: {
      // Tells no-unused-vars that a component referenced in JSX counts as used.
      // Without this, `const X = ({ icon: Icon }) => <Icon />` is flagged as unused.
      'react/jsx-uses-vars': 'error',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // Ignore React: this project uses the automatic JSX runtime, so
      // `import React from 'react'` is vestigial, not required.
      // Everything else is checked strictly, including ALL-CAPS component
      // names — react/jsx-uses-vars marks those used when JSX references them.
      'no-unused-vars': ['error', { ignoreRestSiblings: true, varsIgnorePattern: '^React$' }],
    },
  },
]
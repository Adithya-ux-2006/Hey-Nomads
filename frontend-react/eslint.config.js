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
      // Node globals for the serverless handler and the seed/verify scripts,
      // which share this config. Previously only the browser set was declared,
      // which is why `no-undef` could not have been on: it would have failed
      // everywhere.
      globals: { ...globals.browser, ...globals.node },
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
      // Spread the recommended rules in. Without this, the literal below
      // replaces recommended.rules wholesale, which silently dropped no-undef
      // and let three pages ship referencing identifiers that were never
      // imported (MatchesPage's Spinner, two handlers that did not exist).
      // They were blank-screen crashes that lint reported as clean.
      ...js.configs.recommended.rules,
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
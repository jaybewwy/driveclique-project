import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'android', 'ios']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      jsxA11y.flatConfigs.recommended,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: {
      // Allow setState in effects for data fetching patterns (e.g., context providers)
      'react-hooks/set-state-in-effect': 'off',
      // Allow unused variables prefixed with underscore
      'no-unused-vars': ['error', { varsIgnorePattern: '^_', argsIgnorePattern: '^_' }],
      // A silently-swallowed error is how a 403 (or any failed request) ends up
      // rendering as fake-looking data, e.g. a fallback "0" indistinguishable from
      // a real zero count. If a catch genuinely doesn't need to do anything (e.g.
      // best-effort analytics), say so explicitly with an eslint-disable-next-line
      // and a one-line reason instead of silently matching one of these shapes.
      'no-restricted-syntax': [
        'error',
        {
          selector: 'CatchClause > BlockStatement[body.length=0]',
          message: 'Empty catch block silently swallows the error. Log it, set an error/failed state the UI can render, or justify the silence with an eslint-disable-next-line comment.',
        },
        {
          selector: "CallExpression[callee.property.name='catch'] > ArrowFunctionExpression[body.type='BlockStatement'][body.body.length=0]",
          message: '.catch(() => {}) silently swallows the error. Log it, set an error/failed state the UI can render, or justify the silence with an eslint-disable-next-line comment.',
        },
        {
          selector: "CallExpression[callee.property.name='catch'] > ArrowFunctionExpression[body.type='Literal']",
          message: '.catch(() => <constant>) turns a failed request into fake-looking data. Track that it failed and render that distinctly, or justify the silence with an eslint-disable-next-line comment.',
        },
        {
          selector: "CallExpression[callee.property.name='catch'] > ArrowFunctionExpression[body.type='ArrayExpression']",
          message: '.catch(() => []) turns a failed request into fake-looking data (an empty list indistinguishable from "really has nothing"). Track that it failed and render that distinctly, or justify the silence with an eslint-disable-next-line comment.',
        },
        {
          selector: "CallExpression[callee.property.name='catch'] > ArrowFunctionExpression[body.type='ObjectExpression']",
          message: '.catch(() => ({})) turns a failed request into fake-looking data. Track that it failed and render that distinctly, or justify the silence with an eslint-disable-next-line comment.',
        },
      ],
    },
  },
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
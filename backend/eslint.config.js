import js from '@eslint/js';
import globals from 'globals';

// Reglas de estilo del backend.
export default [
  { ignores: ['node_modules/'] },
  js.configs.recommended,
  {
    files: ['**/*.js', '**/*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: globals.node },
    rules: { 'no-unused-vars': ['error', { argsIgnorePattern: '^(req|res|next)$' }] },
  },
  {
    files: ['**/*.cjs', 'database/migrations/*.js', '.sequelizerc'],
    languageOptions: { sourceType: 'commonjs', globals: globals.node },
  },
];

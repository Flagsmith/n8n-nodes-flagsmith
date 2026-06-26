import { config } from '@n8n/node-cli/eslint';

// Exclude unit tests from n8n node linting: vitest imports trip the
// community-node no-restricted-imports rule, and tests are not part of
// the published package.
export default [
  ...(Array.isArray(config) ? config : [config]),
  { ignores: ['test/**'] },
];

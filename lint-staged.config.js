export default {
  // Apply prettier to all JS/TS files
  '*.{js,jsx,ts,tsx}': ['prettier --write'],

  // Server-specific checks
  'packages/server/**/*.{js,jsx,ts,tsx}': [
    () => 'npx tsc -p packages/server/tsconfig.json --noEmit',
    'npm run lint -- --fix',
  ],
}

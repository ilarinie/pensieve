export default {
  // Apply prettier to all supported file types
  '*.{js,jsx,ts,tsx,json,md,yml,yaml}': ['prettier --write'],

  // Server-specific checks
  'packages/server/**/*.{js,jsx,ts,tsx}': [
    () => 'npx tsc -p packages/server/tsconfig.json --noEmit',
    'npm run lint -- --fix',
  ],
}

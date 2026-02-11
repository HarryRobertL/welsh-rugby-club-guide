const expoConfig = require('eslint-config-expo/flat');

module.exports = [
  ...expoConfig,
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'build/**',
      'web-build/**',
      '.expo/**',
      'supabase/functions/**',
      '*.config.js',
    ],
  },
];

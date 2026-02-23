/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  roots: ['<rootDir>/test'],
  setupFiles: ['<rootDir>/test/setup.ts'],
  globalSetup: '<rootDir>/test/global-setup.ts',
  globalTeardown: '<rootDir>/test/global-teardown.ts',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|@tanstack/.*|@orbital/.*|tamagui|@tamagui/.*|color-hash|usehooks-ts)',
  ],
  moduleNameMapper: {
    '^.*/utils/storage$': '<rootDir>/test/mocks/storage.ts',
    '^@/(.*)$': '<rootDir>/$1',
  },
  testTimeout: 30000,
};

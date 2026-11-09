/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Unitarias: junto al código (src/) y en tests/. Las de integración van aparte (jest.int.config.js).
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/', '\\.int\\.test\\.ts$'],
  verbose: true,
  forceExit: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.d.ts',
    '!src/**/*.prisma-store.ts',
    '!src/server.ts',
  ],
  coverageThreshold: { global: { statements: 80, branches: 80, functions: 80, lines: 80 } },
};

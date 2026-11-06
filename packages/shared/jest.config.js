/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  collectCoverageFrom: ['src/**/*.ts', '!src/index.ts', '!src/types.ts'],
  coverageThreshold: {
    './src/optimizer.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
    global: { statements: 90, branches: 90, functions: 90, lines: 90 },
  },
};

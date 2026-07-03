module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/tests/unit'],
  testMatch: ['**/*.test.js'],

  // Ortak boilerplate: loadSource() + stubGlobals() + resetStubs()
  // (bkz. tests/helpers/setup.js). --verbose artık config'te değil;
  // "npm run test:ci" ile açılır, günlük döngüde sessiz kalır.
  setupFiles: ['<rootDir>/tests/helpers/setup.js'],
};

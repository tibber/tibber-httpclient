/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest/presets/js-with-babel',
  testEnvironment: 'node',
  // got's ESM package in v12.x is not compatible with jest's ESM support
  transformIgnorePatterns: [
    '/node_modules/(?!(got|p-cancelable|@szmarczak|lowercase-keys|@sindresorhus/is|form-data-encoder|cacheable-request|normalize-url|responselike|mimic-response|cacheable-lookup)/)',
  ],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/'],
};

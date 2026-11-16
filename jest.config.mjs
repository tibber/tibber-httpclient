/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/js-with-ts',
  testEnvironment: 'node',
  // got's ESM package is not compatible with jest's ESM support
  transformIgnorePatterns: [
    '/node_modules/(?!(got|@sindresorhus/is|@keyv/serialize|@sec-ant/readable-stream|byte-counter|cacheable-request|chunk-data|decompress-response|get-stream|is-stream|keyv|lowercase-keys|mimic-response|normalize-url|responselike|uint8array-extras)/)',
  ],
  testPathIgnorePatterns: ['<rootDir>/node_modules/', '<rootDir>/dist/'],
};

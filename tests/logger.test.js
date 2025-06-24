const originalEnv = process.env;

describe('logger', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('defaults to info level when no env vars', () => {
    delete process.env.LOG_LEVEL;
    delete process.env.NODE_ENV;
    const logger = require('../src/logger');
    expect(logger.level).toBe('info');
  });

  it('uses LOG_LEVEL env var when set', () => {
    process.env.LOG_LEVEL = 'debug';
    const logger = require('../src/logger');
    expect(logger.level).toBe('debug');
  });

  it('silences logger when NODE_ENV=test', () => {
    process.env.NODE_ENV = 'test';
    const logger = require('../src/logger');
    expect(logger.level).toBe('silent');
  });

  it('defines standard logging methods', () => {
    const logger = require('../src/logger');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.error).toBe('function');
    // should not throw on method calls
    expect(() => logger.info('test')).not.toThrow();
  });
});

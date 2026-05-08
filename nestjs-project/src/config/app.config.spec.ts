import appConfig from './app.config';

describe('appConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('reads values from environment variables', () => {
    process.env.PORT = '4000';
    process.env.NODE_ENV = 'production';

    const config = appConfig();

    expect(config).toEqual({
      port: 4000,
      nodeEnv: 'production',
    });
  });

  it('applies defaults when environment variables are not set', () => {
    delete process.env.PORT;
    delete process.env.NODE_ENV;

    const config = appConfig();

    expect(config.port).toBe(3000);
    expect(config.nodeEnv).toBe('development');
  });

  it('parses PORT as a number', () => {
    process.env.PORT = '8080';

    const config = appConfig();

    expect(typeof config.port).toBe('number');
    expect(config.port).toBe(8080);
  });
});

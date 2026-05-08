import databaseConfig from './database.config';

describe('databaseConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('reads values from environment variables', () => {
    process.env.DB_HOST = 'db-host';
    process.env.DB_PORT = '5433';
    process.env.DB_USERNAME = 'user';
    process.env.DB_PASSWORD = 'pass';
    process.env.DB_NAME = 'mydb';

    const config = databaseConfig();

    expect(config).toEqual({
      host: 'db-host',
      port: 5433,
      username: 'user',
      password: 'pass',
      name: 'mydb',
    });
  });

  it('applies defaults when environment variables are not set', () => {
    delete process.env.DB_HOST;
    delete process.env.DB_PORT;
    delete process.env.DB_USERNAME;
    delete process.env.DB_PASSWORD;
    delete process.env.DB_NAME;

    const config = databaseConfig();

    expect(config.host).toBe('localhost');
    expect(config.port).toBe(5432);
    expect(config.username).toBe('streamtube');
    expect(config.password).toBe('streamtube');
    expect(config.name).toBe('streamtube');
  });

  it('parses DB_PORT as a number', () => {
    process.env.DB_PORT = '5433';

    const config = databaseConfig();

    expect(typeof config.port).toBe('number');
    expect(config.port).toBe(5433);
  });
});

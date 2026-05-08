import { validationSchema } from './env.validation';

interface EnvValues {
  NODE_ENV: string;
  PORT: number;
  DB_HOST: string;
  DB_PORT: number;
  DB_USERNAME: string;
  DB_PASSWORD: string;
  DB_NAME: string;
}

const validEnv: EnvValues = {
  NODE_ENV: 'development',
  PORT: 3000,
  DB_HOST: 'localhost',
  DB_PORT: 5432,
  DB_USERNAME: 'streamtube',
  DB_PASSWORD: 'streamtube',
  DB_NAME: 'streamtube',
};

function validate(env: object): { error?: Error; value: EnvValues } {
  const result = validationSchema.validate(env);
  return { error: result.error, value: result.value as EnvValues };
}

describe('validationSchema', () => {
  it('accepts a valid environment', () => {
    const { error } = validate(validEnv);
    expect(error).toBeUndefined();
  });

  it.each(['DB_USERNAME', 'DB_PASSWORD', 'DB_NAME'])(
    'rejects when %s is missing',
    (field) => {
      const { error } = validate({ ...validEnv, [field]: undefined });
      expect(error).toBeDefined();
      expect(error?.message).toContain(field);
    },
  );

  it('rejects an invalid NODE_ENV value', () => {
    const { error } = validate({ ...validEnv, NODE_ENV: 'staging' });
    expect(error).toBeDefined();
  });

  it('applies default NODE_ENV=development when omitted', () => {
    const { value } = validate({ ...validEnv, NODE_ENV: undefined });
    expect(value.NODE_ENV).toBe('development');
  });

  it('applies default PORT=3000 when omitted', () => {
    const { value } = validate({ ...validEnv, PORT: undefined });
    expect(value.PORT).toBe(3000);
  });

  it('applies default DB_HOST=localhost when omitted', () => {
    const { value } = validate({ ...validEnv, DB_HOST: undefined });
    expect(value.DB_HOST).toBe('localhost');
  });

  it('applies default DB_PORT=5432 when omitted', () => {
    const { value } = validate({ ...validEnv, DB_PORT: undefined });
    expect(value.DB_PORT).toBe(5432);
  });
});

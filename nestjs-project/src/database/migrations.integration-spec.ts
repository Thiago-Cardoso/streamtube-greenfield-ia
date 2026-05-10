import { DataSource } from 'typeorm';
import { User } from '../users/entities/user.entity';
import { Channel } from '../channels/entities/channel.entity';
import { RefreshToken } from '../auth/entities/refresh-token.entity';
import { VerificationToken } from '../auth/entities/verification-token.entity';
import { CreateUsersAndChannels1778286886393 } from './migrations/1778286886393-CreateUsersAndChannels';
import { CreateAuthTokens1778286955016 } from './migrations/1778286955016-CreateAuthTokens';

describe('Migrations (integration)', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'db',
      port: Number(process.env.DB_PORT ?? 5432),
      username: process.env.DB_USERNAME ?? 'streamtube',
      password: process.env.DB_PASSWORD ?? 'streamtube',
      database: process.env.DB_NAME ?? 'streamtube',
      entities: [User, Channel, RefreshToken, VerificationToken],
      synchronize: false,
      migrationsRun: false,
      migrations: [CreateUsersAndChannels1778286886393, CreateAuthTokens1778286955016],
    });
    await dataSource.initialize();

    await dataSource.query('DROP TABLE IF EXISTS "verification_tokens" CASCADE');
    await dataSource.query('DROP TABLE IF EXISTS "refresh_tokens" CASCADE');
    await dataSource.query('DROP TABLE IF EXISTS "channels" CASCADE');
    await dataSource.query('DROP TABLE IF EXISTS "users" CASCADE');
    await dataSource.query('DROP TABLE IF EXISTS "migrations" CASCADE');
    await dataSource.query('DROP TYPE IF EXISTS "verification_tokens_type_enum" CASCADE');
  });

  afterAll(async () => {
    await dataSource.runMigrations();
    await dataSource.destroy();
  });

  it('runMigrations applies both migrations and all four tables exist', async () => {
    const applied = await dataSource.runMigrations();

    expect(applied).toHaveLength(2);

    const rows = await dataSource.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
       AND table_name = ANY(ARRAY['users','channels','refresh_tokens','verification_tokens'])
       ORDER BY table_name`,
    );
    const tableNames = (rows as Array<{ table_name: string }>).map((r) => r.table_name);
    expect(tableNames).toContain('users');
    expect(tableNames).toContain('channels');
    expect(tableNames).toContain('refresh_tokens');
    expect(tableNames).toContain('verification_tokens');
  });

  it('undoLastMigration removes the token tables', async () => {
    await dataSource.undoLastMigration();

    const rows = await dataSource.query(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public'
       AND table_name = ANY(ARRAY['refresh_tokens','verification_tokens'])`,
    );
    expect(rows).toHaveLength(0);
  });
});

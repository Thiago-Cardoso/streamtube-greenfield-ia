import { AppDataSource } from '../data-source';

async function runSeeds(): Promise<void> {
  await AppDataSource.initialize();
  console.log('Database connection initialized.');

  await AppDataSource.destroy();
  console.log('Seed completed successfully.');
}

runSeeds().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

import * as argon2 from 'argon2';
import { AppDataSource } from '../data-source';
import { User } from '../../users/entities/user.entity';
import { Channel } from '../../channels/entities/channel.entity';

const DEMO_USER = {
  email: 'demo@streamtube.local',
  password: 'Password123!',
  channelName: 'Demo Channel',
  channelNickname: 'demo',
};

async function runSeeds(): Promise<void> {
  await AppDataSource.initialize();
  console.log('Database connection initialized.');

  const userRepo = AppDataSource.getRepository(User);
  const channelRepo = AppDataSource.getRepository(Channel);

  const existing = await userRepo.findOneBy({ email: DEMO_USER.email });
  if (existing) {
    console.log(`User ${DEMO_USER.email} already exists — skipping.`);
  } else {
    const hashedPassword = await argon2.hash(DEMO_USER.password);

    const user = userRepo.create({
      email: DEMO_USER.email,
      password: hashedPassword,
      is_confirmed: true,
    });
    await userRepo.save(user);

    const channel = channelRepo.create({
      name: DEMO_USER.channelName,
      nickname: DEMO_USER.channelNickname,
      description: null,
      user_id: user.id,
    });
    await channelRepo.save(channel);

    console.log(`Created user: ${DEMO_USER.email} / ${DEMO_USER.password}`);
    console.log(`Created channel: ${DEMO_USER.channelName} (@${DEMO_USER.channelNickname})`);
  }

  await AppDataSource.destroy();
  console.log('Seed completed successfully.');
}

runSeeds().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

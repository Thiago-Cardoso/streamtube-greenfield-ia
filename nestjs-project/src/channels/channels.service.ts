import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, QueryFailedError, Repository } from 'typeorm';
import { Channel } from './entities/channel.entity';
import { sanitizeNickname, appendRandomSuffix } from './nickname.util';

@Injectable()
export class ChannelsService {
  constructor(
    @InjectRepository(Channel)
    private readonly channelRepository: Repository<Channel>,
    private readonly dataSource: DataSource,
  ) {}

  async createChannel(userId: string, email: string): Promise<Channel> {
    return this.dataSource.transaction(async (manager) => {
      const baseNickname = sanitizeNickname(email.split('@')[0]);
      let nickname = baseNickname;
      const maxRetries = 5;

      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const existing = await manager.findOne(Channel, { where: { nickname } });
        if (existing) {
          if (attempt < maxRetries) {
            nickname = appendRandomSuffix(baseNickname);
            continue;
          }
          break;
        }

        try {
          return await manager.save(manager.create(Channel, { name: baseNickname, nickname, user_id: userId }));
        } catch (err) {
          if (
            err instanceof QueryFailedError &&
            (err as unknown as { code: string; detail?: string }).code === '23505' &&
            (err as unknown as { code: string; detail?: string }).detail?.includes('nickname') &&
            attempt < maxRetries
          ) {
            nickname = appendRandomSuffix(baseNickname);
            continue;
          }
          throw err;
        }
      }

      throw new Error('Failed to create channel after max retries');
    });
  }
}

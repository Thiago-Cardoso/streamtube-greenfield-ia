import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, QueryFailedError } from 'typeorm';
import { ChannelsService } from './channels.service';
import { Channel } from './entities/channel.entity';

const buildMockManager = (overrides: Partial<{ findOne: jest.Mock; save: jest.Mock; create: jest.Mock; query: jest.Mock }> = {}) => ({
  findOne: jest.fn().mockResolvedValue(null),
  save: jest.fn().mockImplementation((entity: Channel) => Promise.resolve(entity)),
  create: jest.fn().mockImplementation((_entity: unknown, data: Partial<Channel>) => data as Channel),
  query: jest.fn().mockResolvedValue(undefined),
  ...overrides,
});

const buildTestModule = async () => {
  const mockChannelRepository = { find: jest.fn() };
  const mockDataSource = { transaction: jest.fn() };

  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ChannelsService,
      { provide: getRepositoryToken(Channel), useValue: mockChannelRepository },
      { provide: DataSource, useValue: mockDataSource },
    ],
  }).compile();

  return {
    service: module.get(ChannelsService),
    dataSource: mockDataSource,
    module,
  };
};

describe('ChannelsService', () => {
  describe('createChannel', () => {
    it('derives nickname from email and saves channel', async () => {
      const { service, dataSource } = await buildTestModule();
      const manager = buildMockManager();
      dataSource.transaction.mockImplementation(async (fn: (m: typeof manager) => Promise<Channel>) => fn(manager));

      const result = await service.createChannel('user-id', 'hello@example.com');

      expect(manager.findOne).toHaveBeenCalledWith(Channel, { where: { nickname: 'hello' } });
      expect(manager.create).toHaveBeenCalledWith(Channel, expect.objectContaining({ nickname: 'hello', user_id: 'user-id' }));
      expect(manager.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('retries with suffix when pre-check finds existing nickname', async () => {
      const { service, dataSource } = await buildTestModule();
      const manager = buildMockManager({
        findOne: jest.fn()
          .mockResolvedValueOnce({ nickname: 'hello' })
          .mockResolvedValue(null),
      });
      dataSource.transaction.mockImplementation(async (fn: (m: typeof manager) => Promise<Channel>) => fn(manager));

      const result = await service.createChannel('user-id', 'hello@example.com');

      expect(manager.findOne).toHaveBeenCalledTimes(2);
      expect(result).toBeDefined();
    });

    it('retries on concurrent unique violation (23505 on nickname)', async () => {
      const { service, dataSource } = await buildTestModule();
      const conflictError = Object.assign(new QueryFailedError('', [], new Error()), {
        code: '23505',
        detail: 'Key (nickname)=(hello) already exists.',
      });
      const manager = buildMockManager({
        save: jest.fn()
          .mockRejectedValueOnce(conflictError)
          .mockImplementation((entity: Channel) => Promise.resolve(entity)),
      });
      dataSource.transaction.mockImplementation(async (fn: (m: typeof manager) => Promise<Channel>) => fn(manager));

      const result = await service.createChannel('user-id', 'hello@example.com');

      expect(manager.save).toHaveBeenCalledTimes(2);
      expect(result).toBeDefined();
    });

    it('throws after exhausting max retries', async () => {
      const { service, dataSource } = await buildTestModule();
      const manager = buildMockManager({
        findOne: jest.fn().mockResolvedValue({ nickname: 'existing' }),
      });
      dataSource.transaction.mockImplementation(async (fn: (m: typeof manager) => Promise<Channel>) => fn(manager));

      await expect(service.createChannel('user-id', 'hello@example.com')).rejects.toThrow(
        'Failed to create channel after max retries',
      );
    });

    it('propagates non-nickname 23505 errors without retrying', async () => {
      const { service, dataSource } = await buildTestModule();
      const conflictError = Object.assign(new QueryFailedError('', [], new Error()), {
        code: '23505',
        detail: 'Key (user_id)=(user-id) already exists.',
      });
      const manager = buildMockManager({
        save: jest.fn().mockRejectedValue(conflictError),
      });
      dataSource.transaction.mockImplementation(async (fn: (m: typeof manager) => Promise<Channel>) => fn(manager));

      await expect(service.createChannel('user-id', 'hello@example.com')).rejects.toThrow();
      expect(manager.save).toHaveBeenCalledTimes(1);
    });
  });
});

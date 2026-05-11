import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { VideosService } from './videos.service';
import { Video } from './entities/video.entity';
import { VideoStatus } from './enums/video-status.enum';
import { StorageService } from '../storage/storage.service';
import { UsersService } from '../users/users.service';
import { VIDEO_PROCESSING_QUEUE } from '../queue/queue.constants';
import { Readable } from 'stream';
import {
  VideoNotFoundException,
  VideoUploadFailedException,
} from '../common/exceptions/domain.exception';

const makeFile = (overrides: Partial<{ mimetype: string; size: number; buffer: Buffer }> = {}) => ({
  fieldname: 'video',
  originalname: 'test.mp4',
  encoding: '7bit',
  mimetype: 'video/mp4',
  size: 1024,
  buffer: Buffer.from('fake-video-content'),
  ...overrides,
});

const makeUser = () => ({
  id: 'user-id',
  email: 'user@example.com',
  channel: { id: 'channel-id', nickname: 'mychan' },
});

describe('VideosService (unit)', () => {
  let service: VideosService;
  let videoRepository: { create: jest.Mock; save: jest.Mock; findOneBy: jest.Mock };
  let storageService: {
    uploadStream: jest.Mock;
    getObjectStream: jest.Mock;
    getObjectStreamRange: jest.Mock;
    getObjectStat: jest.Mock;
  };
  let usersService: { findByEmailWithChannel: jest.Mock };
  let processingQueue: { add: jest.Mock };

  beforeEach(async () => {
    videoRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOneBy: jest.fn(),
    };

    storageService = {
      uploadStream: jest.fn(),
      getObjectStream: jest.fn(),
      getObjectStreamRange: jest.fn(),
      getObjectStat: jest.fn(),
    };
    usersService = { findByEmailWithChannel: jest.fn() };
    processingQueue = { add: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideosService,
        { provide: getRepositoryToken(Video), useValue: videoRepository },
        { provide: StorageService, useValue: storageService },
        { provide: UsersService, useValue: usersService },
        { provide: getQueueToken(VIDEO_PROCESSING_QUEUE), useValue: processingQueue },
      ],
    }).compile();

    service = module.get(VideosService);
  });

  describe('uploadVideo', () => {
    it('creates video with UPLOADING status and returns it with file_key set', async () => {
      const file = makeFile();
      const user = makeUser();
      const draft = { id: 'v1', slug: 'abc12345678', status: VideoStatus.UPLOADING } as Video;
      const final = { ...draft, file_key: 'abc12345678.mp4' } as Video;

      usersService.findByEmailWithChannel.mockResolvedValue(user as never);
      videoRepository.create.mockReturnValue(draft);
      videoRepository.save!
        .mockResolvedValueOnce(draft)
        .mockResolvedValueOnce(final);
      storageService.uploadStream.mockResolvedValue(undefined);

      const result = await service.uploadVideo('user@example.com', file);

      expect(result.file_key).toBeDefined();
      expect(videoRepository.save).toHaveBeenCalledTimes(2);
      expect(storageService.uploadStream).toHaveBeenCalledWith(
        'videos',
        expect.stringMatching(/^.+\.mp4$/),
        expect.anything(),
        file.size,
        file.mimetype,
      );
      expect(processingQueue.add).toHaveBeenCalledWith(
        'process-video',
        expect.objectContaining({ videoId: final.id, fileKey: expect.stringMatching(/^.+\.mp4$/) }),
      );
    });

    it('sets status to FAILED and throws VideoUploadFailedException when storage fails', async () => {
      const file = makeFile();
      const user = makeUser();
      const draft = { id: 'v1', slug: 'abc12345678', status: VideoStatus.UPLOADING } as Video;

      usersService.findByEmailWithChannel.mockResolvedValue(user as never);
      videoRepository.create.mockReturnValue(draft);
      videoRepository.save.mockResolvedValue(draft);
      storageService.uploadStream.mockRejectedValue(new Error('MinIO down'));

      await expect(service.uploadVideo('user@example.com', file)).rejects.toBeInstanceOf(
        VideoUploadFailedException,
      );

      expect(videoRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: VideoStatus.FAILED }),
      );
    });
  });

  describe('findBySlug', () => {
    it('throws VideoNotFoundException for unknown slug', async () => {
      videoRepository.findOneBy.mockResolvedValue(null);

      await expect(service.findBySlug('unknown-slug')).rejects.toBeInstanceOf(
        VideoNotFoundException,
      );
    });

    it('returns video when found', async () => {
      const video = { id: 'v1', slug: 'abc12345678' } as Video;
      videoRepository.findOneBy.mockResolvedValue(video);

      const result = await service.findBySlug('abc12345678');

      expect(result).toBe(video);
    });
  });

  describe('streamVideo', () => {
    const readyVideo = {
      id: 'v1',
      slug: 'abc12345678',
      status: VideoStatus.READY,
      file_key: 'abc12345678.mp4',
      mime_type: 'video/mp4',
    } as Video;

    it('throws VideoNotFoundException when video not found', async () => {
      videoRepository.findOneBy.mockResolvedValue(null);

      await expect(service.streamVideo('unknown')).rejects.toBeInstanceOf(VideoNotFoundException);
    });

    it('throws VideoNotFoundException when video is not READY', async () => {
      videoRepository.findOneBy.mockResolvedValue({
        ...readyVideo,
        status: VideoStatus.UPLOADING,
      });

      await expect(service.streamVideo('abc12345678')).rejects.toBeInstanceOf(VideoNotFoundException);
    });

    it('returns 206 with Content-Range header for Range request', async () => {
      videoRepository.findOneBy.mockResolvedValue(readyVideo);
      storageService.getObjectStat.mockResolvedValue({ size: 100000 });
      const mockStream = new Readable({ read() {} });
      storageService.getObjectStreamRange.mockResolvedValue(mockStream);

      const result = await service.streamVideo('abc12345678', 'bytes=0-999');

      expect(result.status).toBe(206);
      expect(result.headers['Content-Range']).toBe('bytes 0-999/100000');
      expect(result.headers['Accept-Ranges']).toBe('bytes');
      expect(result.headers['Content-Length']).toBe('1000');
      expect(result.stream).toBe(mockStream);
    });

    it('returns 200 with full stream when no Range header', async () => {
      videoRepository.findOneBy.mockResolvedValue(readyVideo);
      const mockStream = new Readable({ read() {} });
      storageService.getObjectStream.mockResolvedValue(mockStream);

      const result = await service.streamVideo('abc12345678');

      expect(result.status).toBe(200);
      expect(result.stream).toBe(mockStream);
    });
  });
});

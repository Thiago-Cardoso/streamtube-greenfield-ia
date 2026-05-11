jest.mock('fluent-ffmpeg', () => {
  const mockInstance = {
    screenshots: jest.fn().mockReturnThis(),
    on: jest.fn().mockImplementation(function (
      this: { screenshots: jest.Mock; on: jest.Mock },
      event: string,
      cb: () => void,
    ) {
      if (event === 'end') cb();
      return this;
    }),
  };
  const mockFn = jest.fn().mockReturnValue(mockInstance) as jest.Mock & {
    ffprobe: jest.Mock;
    setFfprobePath: jest.Mock;
  };
  mockFn.ffprobe = jest.fn();
  mockFn.setFfprobePath = jest.fn();
  return mockFn;
});

jest.mock('@ffprobe-installer/ffprobe', () => ({ path: '/mock/ffprobe' }));

jest.mock('fs', () => ({
  ...jest.requireActual<typeof import('fs')>('fs'),
  mkdirSync: jest.fn(),
  createWriteStream: jest.fn(),
  createReadStream: jest.fn().mockReturnValue({}),
  statSync: jest.fn().mockReturnValue({ size: 1024 }),
  rmSync: jest.fn(),
}));

import * as fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { PassThrough, Readable } from 'stream';
import { VideoProcessorService } from './video-processor.service';
import { Video } from '../videos/entities/video.entity';
import { VideoStatus } from '../videos/enums/video-status.enum';
import { StorageService } from '../storage/storage.service';
import { VIDEO_PROCESSING_QUEUE } from '../queue/queue.constants';

const mockFfmpeg = ffmpeg as unknown as jest.Mock & { ffprobe: jest.Mock; setFfprobePath: jest.Mock };

const makeJob = (overrides: Partial<{ name: string; data: object }> = {}) => ({
  name: 'process-video',
  data: { videoId: 'v1', fileKey: 'abc.mp4', slug: 'abc12345678' },
  ...overrides,
});

const makeDownloadStream = () => {
  const writeStream = new PassThrough();
  (fs.createWriteStream as jest.Mock).mockReturnValue(writeStream);

  const stream = new Readable({
    read() {
      this.push(Buffer.from('fake-video-data'));
      this.push(null);
    },
  });

  return { stream, writeStream };
};

describe('VideoProcessorService (unit)', () => {
  let service: VideoProcessorService;
  let videoRepository: { update: jest.Mock };
  let storageService: { getObjectStream: jest.Mock; uploadStream: jest.Mock };

  beforeEach(async () => {
    videoRepository = { update: jest.fn().mockResolvedValue(undefined) };
    storageService = {
      getObjectStream: jest.fn(),
      uploadStream: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VideoProcessorService,
        { provide: getRepositoryToken(Video), useValue: videoRepository },
        { provide: StorageService, useValue: storageService },
        { provide: getQueueToken(VIDEO_PROCESSING_QUEUE), useValue: {} },
      ],
    }).compile();

    service = module.get(VideoProcessorService);
    jest.clearAllMocks();
    videoRepository.update.mockResolvedValue(undefined);
    storageService.uploadStream.mockResolvedValue(undefined);
    (fs.createReadStream as jest.Mock).mockReturnValue({});
    (fs.statSync as jest.Mock).mockReturnValue({ size: 1024 });
  });

  describe('process', () => {
    it('sets status to PROCESSING before ffprobe and READY on success', async () => {
      const { stream } = makeDownloadStream();
      storageService.getObjectStream.mockResolvedValue(stream);

      mockFfmpeg.ffprobe.mockImplementation(
        (_path: string, cb: (err: null, meta: object) => void) =>
          cb(null, { format: { duration: 60 } }),
      );

      await service.process(makeJob() as never);

      expect(videoRepository.update).toHaveBeenNthCalledWith(1, 'v1', {
        status: VideoStatus.PROCESSING,
      });
      expect(videoRepository.update).toHaveBeenLastCalledWith('v1', {
        duration: 60,
        thumbnail_key: 'abc12345678.jpg',
        status: VideoStatus.READY,
      });
    });

    it('calls storageService.uploadStream for the thumbnail', async () => {
      const { stream } = makeDownloadStream();
      storageService.getObjectStream.mockResolvedValue(stream);

      mockFfmpeg.ffprobe.mockImplementation(
        (_path: string, cb: (err: null, meta: object) => void) =>
          cb(null, { format: { duration: 30 } }),
      );

      await service.process(makeJob() as never);

      expect(storageService.uploadStream).toHaveBeenCalledWith(
        'thumbnails',
        'abc12345678.jpg',
        expect.anything(),
        1024,
        'image/jpeg',
      );
    });

    it('sets status to FAILED and rethrows on ffprobe error', async () => {
      const { stream } = makeDownloadStream();
      storageService.getObjectStream.mockResolvedValue(stream);

      mockFfmpeg.ffprobe.mockImplementation((_path: string, cb: (err: Error) => void) =>
        cb(new Error('ffprobe failed')),
      );

      await expect(service.process(makeJob() as never)).rejects.toThrow('ffprobe failed');

      expect(videoRepository.update).toHaveBeenCalledWith('v1', { status: VideoStatus.FAILED });
    });

    it('sets status to FAILED and rethrows on MinIO download error', async () => {
      storageService.getObjectStream.mockRejectedValue(new Error('MinIO unavailable'));

      await expect(service.process(makeJob() as never)).rejects.toThrow('MinIO unavailable');

      expect(videoRepository.update).toHaveBeenCalledWith('v1', { status: VideoStatus.FAILED });
    });

    it('cleans up temp dir in finally block regardless of success or failure', async () => {
      storageService.getObjectStream.mockRejectedValue(new Error('oops'));

      await expect(service.process(makeJob() as never)).rejects.toThrow();

      expect(fs.rmSync).toHaveBeenCalledWith(expect.stringContaining('abc12345678'), {
        recursive: true,
        force: true,
      });
    });
  });
});

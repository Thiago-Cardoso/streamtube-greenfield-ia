import { Processor, WorkerHost } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import ffmpeg from 'fluent-ffmpeg';
import * as ffprobeInstaller from '@ffprobe-installer/ffprobe';
import * as fs from 'fs';
import * as path from 'path';
import { Repository } from 'typeorm';
import { StorageService } from '../storage/storage.service';
import { Video } from '../videos/entities/video.entity';
import { VideoStatus } from '../videos/enums/video-status.enum';
import { VIDEO_PROCESSING_QUEUE, PROCESS_VIDEO_JOB } from '../queue/queue.constants';

ffmpeg.setFfprobePath(ffprobeInstaller.path);

interface ProcessVideoPayload {
  videoId: string;
  fileKey: string;
  slug: string;
}

@Processor(VIDEO_PROCESSING_QUEUE)
export class VideoProcessorService extends WorkerHost {
  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    private readonly storageService: StorageService,
  ) {
    super();
  }

  async process(job: Job<ProcessVideoPayload>): Promise<void> {
    if (job.name !== PROCESS_VIDEO_JOB) return;

    const { videoId, fileKey, slug } = job.data;
    const tmpDir = `/tmp/streamtube/${slug}`;
    const inputPath = path.join(tmpDir, 'input');
    const thumbnailFilename = `${slug}.jpg`;
    const thumbnailPath = path.join(tmpDir, thumbnailFilename);

    try {
      await this.videoRepository.update(videoId, { status: VideoStatus.PROCESSING });

      fs.mkdirSync(tmpDir, { recursive: true });

      const objectStream = await this.storageService.getObjectStream('videos', fileKey);
      await new Promise<void>((resolve, reject) => {
        objectStream
          .pipe(fs.createWriteStream(inputPath))
          .on('finish', resolve)
          .on('error', reject);
      });

      const duration = await new Promise<number>((resolve, reject) => {
        ffmpeg.ffprobe(inputPath, (err, metadata) => {
          if (err) return reject(err);
          resolve(metadata.format.duration ?? 0);
        });
      });

      const timestampSeconds = Math.max(1, duration * 0.1);
      await new Promise<void>((resolve, reject) => {
        ffmpeg(inputPath)
          .screenshots({
            timestamps: [timestampSeconds],
            filename: thumbnailFilename,
            folder: tmpDir,
          })
          .on('end', () => resolve())
          .on('error', reject);
      });

      const thumbnailStat = fs.statSync(thumbnailPath);
      const thumbnailStream = fs.createReadStream(thumbnailPath);
      const thumbnailKey = `${slug}.jpg`;
      await this.storageService.uploadStream(
        'thumbnails',
        thumbnailKey,
        thumbnailStream,
        thumbnailStat.size,
        'image/jpeg',
      );

      await this.videoRepository.update(videoId, {
        duration,
        thumbnail_key: thumbnailKey,
        status: VideoStatus.READY,
      });
    } catch (err) {
      await this.videoRepository.update(videoId, { status: VideoStatus.FAILED });
      throw err;
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  }
}

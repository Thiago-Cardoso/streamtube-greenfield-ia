import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Repository } from 'typeorm';
import { Readable } from 'stream';
import { nanoid } from 'nanoid';
import { Video } from './entities/video.entity';
import { VideoStatus } from './enums/video-status.enum';
import { StorageService } from '../storage/storage.service';
import { UsersService } from '../users/users.service';
import {
  VideoNotFoundException,
  VideoUploadFailedException,
} from '../common/exceptions/domain.exception';
import {
  VIDEO_PROCESSING_QUEUE,
  PROCESS_VIDEO_JOB,
} from '../queue/queue.constants';

export interface StreamResult {
  stream: Readable;
  headers: Record<string, string>;
  status: 200 | 206;
}

interface UploadedVideoFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const SUPPORTED_MIME_TYPES: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/quicktime': '.mov',
  'video/webm': '.webm',
  'video/x-msvideo': '.avi',
};

@Injectable()
export class VideosService {
  constructor(
    @InjectRepository(Video)
    private readonly videoRepository: Repository<Video>,
    private readonly storageService: StorageService,
    private readonly usersService: UsersService,
    @InjectQueue(VIDEO_PROCESSING_QUEUE)
    private readonly processingQueue: Queue,
  ) {}

  async uploadVideo(
    userEmail: string,
    file: UploadedVideoFile,
  ): Promise<Video> {
    const slug = nanoid(11);

    const user = await this.usersService.findByEmailWithChannel(userEmail);
    if (!user?.channel) {
      throw new Error('User channel not found');
    }

    const ext = SUPPORTED_MIME_TYPES[file.mimetype] ?? '.mp4';
    const fileKey = `${slug}${ext}`;

    const video = await this.videoRepository.save(
      this.videoRepository.create({
        slug,
        channel_id: user.channel.id,
        status: VideoStatus.UPLOADING,
        mime_type: file.mimetype,
        size: String(file.size),
      }),
    );

    try {
      await this.storageService.uploadStream(
        'videos',
        fileKey,
        Readable.from(file.buffer),
        file.size,
        file.mimetype,
      );
    } catch {
      await this.videoRepository.save({ ...video, status: VideoStatus.FAILED });
      throw new VideoUploadFailedException();
    }

    const saved = await this.videoRepository.save({ ...video, file_key: fileKey });

    await this.processingQueue.add(PROCESS_VIDEO_JOB, {
      videoId: saved.id,
      fileKey,
      slug: saved.slug,
    });

    return saved;
  }

  async findBySlug(slug: string): Promise<Video> {
    const video = await this.videoRepository.findOneBy({ slug });
    if (!video) throw new VideoNotFoundException();
    return video;
  }

  async getThumbnailStream(slug: string): Promise<Readable> {
    const video = await this.videoRepository.findOneBy({ slug });
    if (!video || !video.thumbnail_key) throw new VideoNotFoundException();
    return this.storageService.getObjectStream('thumbnails', video.thumbnail_key);
  }

  async getDownloadStream(slug: string): Promise<{ stream: Readable; mimeType: string }> {
    const video = await this.videoRepository.findOneBy({ slug });
    if (!video || !video.file_key) throw new VideoNotFoundException();
    const stream = await this.storageService.getObjectStream('videos', video.file_key);
    return { stream, mimeType: video.mime_type ?? 'video/mp4' };
  }

  async streamVideo(slug: string, rangeHeader?: string): Promise<StreamResult> {
    const video = await this.videoRepository.findOneBy({ slug });
    if (!video || video.status !== VideoStatus.READY) throw new VideoNotFoundException();

    const bucket = 'videos';
    const key = video.file_key!;
    const contentType = video.mime_type ?? 'video/mp4';

    if (rangeHeader) {
      const stat = await this.storageService.getObjectStat(bucket, key);
      const total = stat.size;
      const [, rangeValues] = rangeHeader.split('=');
      const [rawStart, rawEnd] = rangeValues.split('-');
      const start = parseInt(rawStart, 10);
      const end = rawEnd ? parseInt(rawEnd, 10) : total - 1;
      const chunkSize = end - start + 1;

      const stream = await this.storageService.getObjectStreamRange(bucket, key, start, end);
      return {
        stream,
        status: 206,
        headers: {
          'Content-Range': `bytes ${start}-${end}/${total}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(chunkSize),
          'Content-Type': contentType,
        },
      };
    }

    const stream = await this.storageService.getObjectStream(bucket, key);
    return {
      stream,
      status: 200,
      headers: { 'Content-Type': contentType },
    };
  }
}

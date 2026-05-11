import {
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Res,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Request, Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Public } from '../auth/decorators/public.decorator';
import type { JwtPayload } from '../auth/auth.types';
import { VideosService } from './videos.service';
import { VideoInvalidMimeTypeException } from '../common/exceptions/domain.exception';

interface UploadedVideoFile {
  fieldname: string;
  originalname: string;
  encoding: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

const ACCEPTED_MIME_TYPES = new Set([
  'video/mp4',
  'video/quicktime',
  'video/webm',
  'video/x-msvideo',
]);

const videoMimeTypeFilter = (
  _req: Request,
  file: UploadedVideoFile,
  callback: (error: Error | null, acceptFile: boolean) => void,
): void => {
  if (ACCEPTED_MIME_TYPES.has(file.mimetype)) {
    callback(null, true);
  } else {
    callback(new VideoInvalidMimeTypeException(), false);
  }
};

@Controller('videos')
export class VideosController {
  constructor(private readonly videosService: VideosService) {}

  @Post()
  @HttpCode(201)
  @UseInterceptors(
    FileInterceptor('video', {
      storage: memoryStorage(),
      limits: { fileSize: 500 * 1024 * 1024 },
      fileFilter: videoMimeTypeFilter,
    }),
  )
  async upload(
    @CurrentUser() user: JwtPayload,
    @UploadedFile() file: UploadedVideoFile,
  ): Promise<{ id: string; slug: string; status: string }> {
    const video = await this.videosService.uploadVideo(user.email, file);
    return { id: video.id, slug: video.slug, status: video.status };
  }

  @Public()
  @Get(':slug')
  async findOne(@Param('slug') slug: string) {
    const video = await this.videosService.findBySlug(slug);
    return {
      id: video.id,
      slug: video.slug,
      title: video.title,
      status: video.status,
      duration: video.duration,
      size: video.size,
      mime_type: video.mime_type,
      created_at: video.created_at,
    };
  }

  @Public()
  @Get(':slug/stream')
  async stream(
    @Param('slug') slug: string,
    @Headers('range') rangeHeader: string | undefined,
    @Res() res: Response,
  ): Promise<void> {
    const { stream, headers, status } = await this.videosService.streamVideo(slug, rangeHeader);
    res.status(status);
    Object.entries(headers).forEach(([key, value]) => res.setHeader(key, value));
    stream.pipe(res);
  }

  @Public()
  @Get(':slug/thumbnail')
  async thumbnail(@Param('slug') slug: string, @Res() res: Response): Promise<void> {
    const stream = await this.videosService.getThumbnailStream(slug);
    res.setHeader('Content-Type', 'image/jpeg');
    stream.pipe(res);
  }

  @Public()
  @Get(':slug/download')
  async download(@Param('slug') slug: string, @Res() res: Response): Promise<void> {
    const { stream, mimeType } = await this.videosService.getDownloadStream(slug);
    res.setHeader('Content-Disposition', `attachment; filename="${slug}.mp4"`);
    res.setHeader('Content-Type', mimeType);
    stream.pipe(res);
  }
}

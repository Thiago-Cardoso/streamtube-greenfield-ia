# Phase 03 — Upload e Processamento de Vídeos

## Objective

Deliver the complete video pipeline: upload via NestJS streaming to MinIO, automatic draft registration, background FFmpeg processing (duration extraction and thumbnail generation), unique slug-based URLs, HTTP range streaming, and a minimal upload/watch UI in the Next.js frontend.

---

## Step Implementations

### SI-03.1 — Infrastructure: MinIO, Redis, and Config Namespaces

**Description:** Add MinIO (object storage) and Redis (BullMQ broker) as new Docker Compose services, create the corresponding config namespaces following the `registerAs` pattern from Phase 01, and extend the Joi validation schema with all new environment variables.

**Technical actions:**

- Add `minio` service to `docker-compose.yml` — image `minio/minio:latest`, command `server /data --console-address ":9001"`, ports `9000:9000` (API) and `9001:9001` (Console), env vars `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD`, named volume `minio_data:/data`; add a `createbuckets` init container using `minio/mc` image to create `videos` and `thumbnails` buckets on startup; add `redis` service — image `redis:7-alpine`, port `6379:6379`, named volume `redis_data:/data`; declare both volumes in the top-level `volumes` section
- Update `nestjs-api` service env vars in `docker-compose.yml` — add `MINIO_ENDPOINT: minio`, `MINIO_PORT: 9000`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_USE_SSL: false`, `MINIO_BUCKET_VIDEOS: videos`, `MINIO_BUCKET_THUMBNAILS: thumbnails`, `REDIS_HOST: redis`, `REDIS_PORT: 6379`; add `minio` and `redis` to `nestjs-api.depends_on`
- Create `src/config/storage.config.ts` — `registerAs('storage', () => ({ endpoint, port, accessKey, secretKey, useSsl, bucketVideos, bucketThumbnails }))` reading the MINIO_* env vars above with correct types (port as number, useSsl as boolean)
- Create `src/config/queue.config.ts` — `registerAs('queue', () => ({ host, port }))` reading `REDIS_HOST` and `REDIS_PORT`
- Extend `src/config/env.validation.ts` Joi schema with all new env vars (MINIO_ACCESS_KEY and MINIO_SECRET_KEY required, others with defaults matching docker-compose values); update `.env.example`

**Dependencies:** None

**Acceptance criteria:**

- `docker compose up -d` starts `minio`, `redis`, and `createbuckets` services without errors; MinIO Console is reachable at `http://localhost:9001`
- `createbuckets` init container creates `videos` and `thumbnails` buckets automatically; buckets are visible in the MinIO Console
- NestJS application starts without errors when all new env vars are provided with the Docker Compose defaults
- Starting the application without `MINIO_ACCESS_KEY` causes a Joi validation error at bootstrap

---

### SI-03.2 — Storage Module

**Description:** Install the minio-js client and create a global `StorageModule` exposing a `StorageService` that wraps MinIO operations (upload stream, get object stream). On module init, ensures both buckets exist.

**Technical actions:**

- Install `minio@^8.x` as a production dependency in `nestjs-project`
- Create `src/storage/storage.constants.ts` — export `MINIO_CLIENT = 'MINIO_CLIENT'` injection token and bucket name re-exports from config
- Create `src/storage/storage.module.ts` — `@Global()` module; provide MinIO `Client` instance under `MINIO_CLIENT` token using `useFactory` with `ConfigService`; on `onModuleInit`, call `makeBucket` for both `videos` and `thumbnails` buckets if they do not already exist (catch `BucketAlreadyOwnedByYou`); export `StorageService`
- Create `src/storage/storage.service.ts` — inject `MINIO_CLIENT`; implement: `uploadStream(bucket: string, key: string, stream: Readable, size: number, contentType: string): Promise<void>` using `client.putObject`; `getObjectStream(bucket: string, key: string): Promise<Readable>` using `client.getObject`; `getObjectStreamRange(bucket: string, key: string, start: number, end: number): Promise<Readable>` using `client.getPartialObject`; `getObjectStat(bucket: string, key: string): Promise<BucketItemStat>` using `client.statObject`
- Import `StorageModule` in `AppModule`

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/storage/storage.module.spec.ts` | Unit | Module compiles; MINIO_CLIENT token is provided |
| `src/storage/storage.service.integration-spec.ts` | Integration | `uploadStream` stores object; `getObjectStream` retrieves correct content; bucket is created on init if missing |

**Dependencies:** SI-03.1

**Acceptance criteria:**

- `StorageModule` registers globally — any module can inject `StorageService` without importing `StorageModule` directly
- `uploadStream` stores an object in MinIO and `getObjectStream` retrieves the same bytes
- If a bucket does not exist on startup, `onModuleInit` creates it without throwing

---

### SI-03.3 — Video Entity and Migration

**Description:** Create the `Video` entity with its status lifecycle enum and a many-to-one relation to `Channel`. Generate the migration and scaffold the `VideosModule`.

**Technical actions:**

- Create `src/videos/enums/video-status.enum.ts` — `export enum VideoStatus { UPLOADING = 'UPLOADING', PROCESSING = 'PROCESSING', READY = 'READY', FAILED = 'FAILED' }`
- Create `src/videos/entities/video.entity.ts` — `@Entity('videos')` with columns: `id` (uuid PK generated), `slug` (varchar(11), unique, index), `title` (varchar(255), nullable — set by user in Phase 04), `status` (enum `VideoStatus`, default `UPLOADING`), `file_key` (varchar, nullable), `thumbnail_key` (varchar, nullable), `duration` (float4, nullable), `size` (bigint, nullable — stored as string via TypeORM `type: 'bigint'`), `mime_type` (varchar, nullable), `channel_id` (uuid, index), `created_at` (CreateDateColumn), `updated_at` (UpdateDateColumn); define `@ManyToOne(() => Channel)` with `@JoinColumn({ name: 'channel_id' })`; add `@Index(['slug'])` for lookup performance
- Generate migration: `npm run migration:generate -- src/database/migrations/CreateVideos`; review generated SQL for enum type, unique constraint on `slug`, and FK to `channels`
- Create `src/videos/videos.module.ts` — `TypeOrmModule.forFeature([Video])` in imports, export `TypeOrmModule`

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/videos/entities/video.entity.integration-spec.ts` | Integration | Unique slug constraint; status defaults to UPLOADING; FK references channels; nullable fields accept null; slug max length enforced |
| `src/videos/videos.module.spec.ts` | Unit | Module compiles with TypeOrmModule.forFeature wiring |

**Dependencies:** SI-03.1

**Acceptance criteria:**

- `npm run migration:run` creates the `videos` table with all columns, the `video_status` enum type, a unique index on `slug`, and a FK constraint to `channels`
- Inserting two videos with the same slug fails with a unique constraint violation
- Querying a newly created video returns `status = 'UPLOADING'` without explicit assignment
- Inserting a video with a non-existent `channel_id` fails with a FK violation

---

### SI-03.4 — Upload Endpoint

**Description:** Implement `POST /videos` — an authenticated multipart endpoint that receives a video file, creates a draft `Video` record with a nanoid slug, streams the file to MinIO via `StorageService`, and enqueues a processing job.

**Technical actions:**

- Install `nanoid@^5.x` as a production dependency; since nanoid v5 is ESM-only, import it dynamically: `const { nanoid } = await import('nanoid')` inside async methods, or use `customAlphabet` from `nanoid/non-secure` — prefer dynamic import of the ESM version to stay compatible with the CommonJS NestJS build
- Create `src/videos/videos.service.ts` — method `uploadVideo(channelId: string, file: Express.Multer.File): Promise<Video>`: (1) generate `nanoid(11)` slug; (2) create and save `Video` entity with `status: UPLOADING`, `slug`, `channel_id`, `mime_type`, `size`, (3) stream `Readable.from(file.buffer)` to MinIO via `StorageService.uploadStream` with key `${slug}${ext}` (ext derived from file mimetype); (4) update entity with `file_key`; (5) enqueue processing job (after SI-03.5 is in place, this step becomes active — scaffold the call now, inject the queue as optional initially); (6) return saved entity; on StorageService error: update status to FAILED and rethrow as `VideoUploadFailedException`
- Create `src/videos/videos.controller.ts` — `@Controller('videos')`; `POST /videos` with `@UseGuards(AuthGuard)`, `@UseInterceptors(FileInterceptor('video', { storage: memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 }, fileFilter: videoMimeTypeFilter }))`, `@HttpCode(201)`; extract authenticated user's `channel_id` from request (via `UsersService.findByEmailWithChannel` or include channel in JWT payload); call `videosService.uploadVideo`; return `{ id, slug, status }`; define `videoMimeTypeFilter` rejecting non-video mimetypes (mp4, quicktime, webm, x-msvideo) with `VideoInvalidMimeTypeException`
- Create domain exceptions: `VideoUploadFailedException` (500), `VideoInvalidMimeTypeException` (400 INVALID_MIME_TYPE), `VideoNotFoundException` (404 VIDEO_NOT_FOUND)
- Register exceptions in `DomainExceptionFilter` (add subclasses); update `src/common/exceptions/domain.exception.ts`

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/videos/videos.service.spec.ts` | Unit | UPLOADING status set on create; StorageService.uploadStream called with correct bucket and key; VideoUploadFailedException thrown when storage fails; video status set to FAILED on storage error |
| `src/videos/videos.service.integration-spec.ts` | Integration | Video row persisted in DB; file key stored; status is UPLOADING after upload |
| `test/videos.e2e-spec.ts` | E2E | POST /videos without auth → 401; POST /videos with valid mp4 → 201 with `{ id, slug, status: 'UPLOADING' }`; POST /videos with text file → 400 INVALID_MIME_TYPE; POST /videos with file > 500MB → 413 |

**Dependencies:** SI-03.2, SI-03.3

**Acceptance criteria:**

- `POST /videos` without a valid access token returns 401
- `POST /videos` with a valid mp4 file and valid auth returns 201 with `{ id, slug, status: 'UPLOADING' }` — slug is 11 URL-safe characters
- `POST /videos` with a `.txt` file returns 400 with `INVALID_MIME_TYPE`
- After a successful upload, a `videos` row exists in DB with `file_key` set and `status = 'UPLOADING'`; the corresponding object exists in the MinIO `videos` bucket
- `POST /videos` when MinIO is unreachable returns 500 and the video record has `status = 'FAILED'`

---

### SI-03.5 — Processing Queue (BullMQ)

**Description:** Install BullMQ, configure the `QueueModule` with Redis, register the `video-processing` queue, and wire the queue into `VideosService` so a processing job is enqueued after every successful upload.

**Technical actions:**

- Install `@nestjs/bullmq@^11.x` and `bullmq@^5.x` as production dependencies in `nestjs-project`
- Create `src/queue/queue.constants.ts` — `export const VIDEO_PROCESSING_QUEUE = 'video-processing'` and `export const PROCESS_VIDEO_JOB = 'process-video'`
- Create `src/queue/queue.module.ts` — `BullModule.forRootAsync({ useFactory: (cfg: ConfigService) => ({ connection: { host: cfg.get('queue.host'), port: cfg.get('queue.port') } }), inject: [ConfigService] })`; `BullModule.registerQueue({ name: VIDEO_PROCESSING_QUEUE })`; export `BullModule`
- Import `QueueModule` in `AppModule`; update `VideosModule` to import `QueueModule`; inject `@InjectQueue(VIDEO_PROCESSING_QUEUE) private readonly processingQueue: Queue` in `VideosService`; activate the `processingQueue.add(PROCESS_VIDEO_JOB, { videoId: video.id, fileKey: video.file_key, slug: video.slug })` call in `uploadVideo`

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/queue/queue.module.spec.ts` | Unit | Module compiles; BullModule.forRootAsync and registerQueue are wired correctly |

**Dependencies:** SI-03.4

**Acceptance criteria:**

- After `POST /videos` with a valid file, a job with name `process-video` appears in the `video-processing` BullMQ queue in Redis (verifiable via `queue.getJobs(['waiting'])` in tests)
- The job payload contains `videoId`, `fileKey`, and `slug`
- `QueueModule` compiles without DI errors

---

### SI-03.6 — Video Worker

**Description:** Create the `WorkerModule` as a NestJS standalone application entry point, implement `VideoProcessorService` using fluent-ffmpeg to extract duration and generate a thumbnail, update video status throughout the pipeline, and add the worker as a separate service in Docker Compose.

**Technical actions:**

- Install `fluent-ffmpeg@^2.x` and `@ffprobe-installer/ffprobe@^1.x` as production dependencies in `nestjs-project`; add `@types/fluent-ffmpeg` as a dev dependency; in the worker module init, set `ffmpeg.setFfprobePath(ffprobeInstaller.path)`; add `RUN apk add --no-cache ffmpeg` to `nestjs-project/Dockerfile.dev` so the FFmpeg binary is available in the worker container
- Create `src/worker/worker.module.ts` — standalone NestJS module importing `ConfigModule.forRoot`, `TypeOrmModule.forRootAsync` (same pattern as AppModule), `StorageModule`, `QueueModule`; declare `VideoProcessorService` as provider
- Create `src/worker/video-processor.service.ts` — `@Processor(VIDEO_PROCESSING_QUEUE)` class; `@Process(PROCESS_VIDEO_JOB)` handler: (1) update video `status = PROCESSING` in DB; (2) download file from MinIO to `/tmp/streamtube/${slug}` using `StorageService.getObjectStream` piped to `fs.createWriteStream`; (3) run `ffprobe` to extract `format.duration`; (4) capture thumbnail at 10% of duration using `fluent-ffmpeg().screenshots({ timestamps: ['10%'], filename: '...', folder: '/tmp/streamtube/' })`; (5) upload thumbnail to MinIO `thumbnails` bucket; (6) update video: `duration`, `thumbnail_key`, `status = READY`; (7) cleanup temp files in `finally` block; on any error: update `status = FAILED`
- Create `src/worker.ts` — `async function bootstrap() { const app = await NestFactory.createApplicationContext(WorkerModule); await app.init(); }` (no HTTP server); add `"start:worker": "ts-node -r tsconfig-paths/register src/worker.ts"` to `package.json` scripts
- Add `video-worker` service to `docker-compose.yml` — same `build` context and `Dockerfile.dev` as `nestjs-api`; command `sh -c "npm ci && npm run start:worker"`; same volumes and env vars as `nestjs-api`; depends on `db`, `minio`, `redis`

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/worker/video-processor.service.spec.ts` | Unit | Status set to PROCESSING before ffprobe; READY after successful processing; FAILED on ffprobe error; FAILED on MinIO download error; StorageService upload called for thumbnail |
| `src/worker/worker.module.spec.ts` | Unit | WorkerModule compiles with all dependencies wired |

**Dependencies:** SI-03.5

**Acceptance criteria:**

- After a video is uploaded (`status = UPLOADING`) and a job is enqueued, the worker transitions the video through `PROCESSING → READY`; `duration` and `thumbnail_key` are set in the DB
- A video file that fails ffprobe analysis results in `status = FAILED`
- Temp files under `/tmp/streamtube/` are deleted after processing regardless of success or failure
- `video-worker` container starts without errors and begins consuming jobs from Redis

---

### SI-03.7 — Streaming, Thumbnail, and Download Endpoints

**Description:** Implement the public read endpoints: video metadata (`GET /videos/:slug`), HTTP range streaming (`GET /videos/:slug/stream`), thumbnail retrieval (`GET /videos/:slug/thumbnail`), and full-file download (`GET /videos/:slug/download`).

**Technical actions:**

- Add to `VideosService`: `findBySlug(slug: string): Promise<Video>` — throws `VideoNotFoundException` if not found; `streamVideo(slug, rangeHeader?: string): Promise<{ stream: Readable; headers: Record<string, string>; status: 206 | 200 }>` — if `Range` header present, parse `bytes=start-end`, call `StorageService.getObjectStreamRange`, return 206 with `Content-Range`, `Accept-Ranges: bytes`, `Content-Length`, `Content-Type` headers; if no Range header, return full stream with 200; throw `VideoNotFoundException` if `status !== READY`
- Add endpoints to `VideosController`:
  - `GET /videos/:slug` — public; returns `{ id, slug, title, status, duration, size, mime_type, created_at }` (no file keys in response)
  - `GET /videos/:slug/stream` — public; calls `streamVideo`; pipes the Readable to response using `res.setHeader(...)` and `stream.pipe(res)` with `@Res() res: Response`; sets correct status code (206 or 200)
  - `GET /videos/:slug/thumbnail` — public; pipes thumbnail stream from MinIO `thumbnails` bucket; sets `Content-Type: image/jpeg`
  - `GET /videos/:slug/download` — public; pipes full video stream; sets `Content-Disposition: attachment; filename="${slug}.mp4"` and `Content-Type` from video entity

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/videos/videos.service.spec.ts` (extend) | Unit | `findBySlug` throws VideoNotFoundException for unknown slug; `streamVideo` builds correct 206 headers for range request |
| `test/videos-streaming.e2e-spec.ts` | E2E | GET /videos/:slug returns 200 with metadata for READY video; GET /videos/:slug/stream returns 206 with Content-Range for valid Range header; GET /videos/:slug/stream returns 404 for unknown slug; GET /videos/:slug/download returns 200 with Content-Disposition attachment header |

**Dependencies:** SI-03.4

**Acceptance criteria:**

- `GET /videos/:slug` for a READY video returns 200 with `{ slug, status: 'READY', duration, ... }` — `file_key` is not exposed
- `GET /videos/:slug` for an unknown slug returns 404 with `VIDEO_NOT_FOUND`
- `GET /videos/:slug/stream` with `Range: bytes=0-999999` returns 206 with `Content-Range: bytes 0-999999/<total>` and `Accept-Ranges: bytes`
- `GET /videos/:slug/stream` without Range header returns 200 and streams the full file
- `GET /videos/:slug/download` returns `Content-Disposition: attachment` — browsers prompt download instead of playing inline
- `GET /videos/:slug/thumbnail` returns the JPEG thumbnail with `Content-Type: image/jpeg`

---

### SI-03.8 — Frontend Upload Page

**Description:** Create the authenticated `/upload` page in Next.js with a file input, upload progress bar (via XMLHttpRequest), direct call to the NestJS API, and redirect to the watch page on success.

**Technical actions:**

- Create `src/app/(protected)/upload/page.tsx` — Server Component; redirect to `/auth/login` if no access token in Zustand store (via a client guard); render `<UploadForm />`
- Create `src/components/videos/upload-form.tsx` — Client Component; `<input type="file" accept="video/*" />`; on submit, use `XMLHttpRequest` to `POST ${NEXT_PUBLIC_API_URL}/videos` with `FormData` containing the file under the `video` field and `Authorization: Bearer <accessToken>` header; track `xhr.upload.onprogress` to update a progress percentage state; on `xhr.onload` with status 201, read `slug` from response JSON and call `router.push(\`/watch/\${slug}\`)`; on error, display the backend error message
- Add an "Upload" link to the authenticated navigation (if a nav component exists from Phase 02, extend it; otherwise create a minimal `<AuthNav />` Client Component that reads auth state and renders links)

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/components/videos/upload-form.test.tsx` | Unit (Vitest) | Renders file input and submit button; shows progress bar after file selection and submit; displays error message on failed upload |
| `e2e/videos/upload.spec.ts` | E2E (Playwright) | Unauthenticated visit to /upload redirects to /auth/login; authenticated user can select a file and see the progress bar; successful upload redirects to /watch/:slug |

**Dependencies:** SI-03.7

**Acceptance criteria:**

- `/upload` redirects to `/auth/login` when accessed without authentication
- Authenticated users see a file input accepting video files and a "Upload" button
- After selecting a video and clicking Upload, a progress bar updates as the file uploads
- On successful upload, the user is redirected to `/watch/:slug`
- On upload error (e.g., invalid file type), an error message is displayed

---

### SI-03.9 — Frontend Video Watch Page

**Description:** Create the `/watch/[slug]` page in Next.js with an HTML5 video player pointing to the NestJS streaming endpoint, video metadata display, and a download button.

**Technical actions:**

- Create `src/app/watch/[slug]/page.tsx` — Server Component; fetch video metadata from `${BACKEND_URL}/videos/${slug}` (server-side, via Docker internal URL); if status is not READY, render a "Processing…" message with auto-refresh (client component polling); if not found, render Next.js `notFound()`
- Create `src/components/videos/video-player.tsx` — Client Component; renders `<video controls src={\`${NEXT_PUBLIC_API_URL}/videos/${slug}/stream\`} poster={\`${NEXT_PUBLIC_API_URL}/videos/${slug}/thumbnail\`} />` with `preload="metadata"`; the browser handles Range requests natively via the `<video>` element
- Display metadata below the player: title (or slug as placeholder), duration formatted as `mm:ss`, upload date
- Download button: `<a href={\`${NEXT_PUBLIC_API_URL}/videos/${slug}/download\`} download>Download</a>`

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/components/videos/video-player.test.tsx` | Unit (Vitest) | Renders `<video>` element with correct `src` and `poster` attributes; download link has correct `href` and `download` attribute |
| `e2e/videos/watch.spec.ts` | E2E (Playwright) | /watch/:slug with valid READY slug shows video element; /watch/invalid shows 404; download button is present and has correct href |

**Dependencies:** SI-03.8

**Acceptance criteria:**

- `/watch/:slug` for a READY video renders a `<video>` element with `src` pointing to `/videos/:slug/stream`
- The poster attribute points to `/videos/:slug/thumbnail`
- `/watch/nonexistent` renders a 404 page
- `/watch/:slug` for a PROCESSING video shows a "Processing…" message
- The download link triggers a file download when clicked

---

## Technical Specifications

### Data Model

#### Video

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| id | uuid | PK, generated | |
| slug | varchar(11) | unique, not null, index | nanoid(11), URL-safe alphabet |
| title | varchar(255) | nullable | Set by user in Phase 04 |
| status | enum | not null, default UPLOADING | VideoStatus enum |
| file_key | varchar | nullable | MinIO object key in `videos` bucket |
| thumbnail_key | varchar | nullable | MinIO object key in `thumbnails` bucket |
| duration | float4 | nullable | Seconds; set by worker after ffprobe |
| size | bigint | nullable | File size in bytes |
| mime_type | varchar | nullable | Original MIME type from upload |
| channel_id | uuid | FK → channels.id, index | |
| created_at | timestamp | auto | |
| updated_at | timestamp | auto | |

**Relations:** Video → Channel (many-to-one, `channel_id` FK owned here)
**Indexes:** `slug` (unique), `channel_id` (for channel video listing in Phase 04)

**VideoStatus enum values:** `UPLOADING`, `PROCESSING`, `READY`, `FAILED`

---

### API Contracts

#### POST /videos (SI-03.4)

**Request headers:**
- Authorization: Bearer `<access_token>`
- Content-Type: multipart/form-data

**Request body (multipart):**
- `video`: file, required — video file (mp4, mov, webm, avi); max 500MB

**Response 201:**
- id: string (uuid)
- slug: string (11 chars)
- status: string (`UPLOADING`)

**Error responses:**
- 401 UNAUTHORIZED: missing or invalid access token
- 400 INVALID_MIME_TYPE: file is not a supported video format
- 413: file exceeds 500MB (Multer/Express default)

---

#### GET /videos/:slug (SI-03.7)

**Response 200:**
- id: string
- slug: string
- title: string | null
- status: string (VideoStatus)
- duration: number | null (seconds)
- size: number | null (bytes)
- mime_type: string | null
- created_at: string (ISO 8601)

**Error responses:**
- 404 VIDEO_NOT_FOUND: slug not found

---

#### GET /videos/:slug/stream (SI-03.7)

**Request headers:**
- Range: bytes=`<start>`-`<end>` (optional)

**Response 206** (when Range header present):
- Body: partial video bytes
- Content-Range: bytes `<start>`-`<end>`/`<total>`
- Accept-Ranges: bytes
- Content-Length: `<partial size>`
- Content-Type: video/mp4 (or original mime_type)

**Response 200** (when no Range header):
- Body: full video stream
- Content-Type: video/mp4

**Error responses:**
- 404 VIDEO_NOT_FOUND: slug not found or video not in READY status

---

#### GET /videos/:slug/thumbnail (SI-03.7)

**Response 200:**
- Body: JPEG image bytes
- Content-Type: image/jpeg

**Error responses:**
- 404 VIDEO_NOT_FOUND

---

#### GET /videos/:slug/download (SI-03.7)

**Response 200:**
- Body: full video file
- Content-Disposition: attachment; filename="`<slug>`.mp4"
- Content-Type: original mime_type

**Error responses:**
- 404 VIDEO_NOT_FOUND

---

### Authorization Matrix

| Endpoint | Public | Authenticated |
|----------|--------|---------------|
| POST /videos | | ✓ |
| GET /videos/:slug | ✓ | |
| GET /videos/:slug/stream | ✓ | |
| GET /videos/:slug/thumbnail | ✓ | |
| GET /videos/:slug/download | ✓ | |

---

### Error Catalog

| Code | HTTP | Message | Trigger |
|------|------|---------|---------|
| VIDEO_NOT_FOUND | 404 | Video not found | GET /videos/:slug or streaming endpoints when slug does not exist or video is not READY |
| INVALID_MIME_TYPE | 400 | File type not supported. Accepted formats: mp4, mov, webm, avi | POST /videos when uploaded file is not a supported video mimetype |
| VIDEO_UPLOAD_FAILED | 500 | Video upload failed | POST /videos when MinIO write fails after the DB record is created |

---

### Events/Messages

| Event | Payload | Publisher | Consumer | Delivery |
|-------|---------|-----------|----------|----------|
| process-video | `{ videoId: string, fileKey: string, slug: string }` | VideosService (after upload) | VideoProcessorService (worker container) | fire-and-forget; BullMQ retries up to 3 times on failure |

---

## Dependency Map

```
SI-03.1 (no deps)
├── SI-03.2
│   └── SI-03.4
│       ├── SI-03.5
│       │   └── SI-03.6
│       └── SI-03.7
│           └── SI-03.8
│               └── SI-03.9
└── SI-03.3
    └── SI-03.4
```

---

## Deliverables

- [ ] MinIO and Redis services running in Docker Compose; MinIO Console accessible at `http://localhost:9001`
- [ ] `videos` and `thumbnails` buckets created automatically on `docker compose up`
- [ ] `POST /videos` accepts mp4 up to 500MB, creates draft video row, streams file to MinIO
- [ ] After upload, a `process-video` job appears in the BullMQ queue
- [ ] Video worker processes the job: sets status to PROCESSING, extracts duration via ffprobe, generates thumbnail, uploads thumbnail to MinIO, sets status to READY
- [ ] `GET /videos/:slug/stream` returns 206 Partial Content with Range headers when `Range` header is present
- [ ] `GET /videos/:slug/thumbnail` returns the generated JPEG thumbnail
- [ ] `GET /videos/:slug/download` returns the file with `Content-Disposition: attachment`
- [ ] `/upload` page (Next.js) allows authenticated users to upload a video file with progress feedback
- [ ] `/watch/:slug` page (Next.js) shows an HTML5 video player, metadata, and download button
- [ ] All SI tests pass in nestjs-project (`docker compose exec nestjs-api npm test -- --runInBand`)
- [ ] All E2E tests pass in nestjs-project (`docker compose exec nestjs-api npm run test:e2e`)
- [ ] All SI tests pass in nextjs-project (`npm test` inside nextjs-project)
- [ ] All E2E tests pass in nextjs-project (`npx playwright test` from nextjs-project)
- [ ] TypeScript compiles cleanly in nestjs-project (`docker compose exec nestjs-api npx tsc --noEmit`)
- [ ] TypeScript compiles cleanly in nextjs-project (`npx tsc --noEmit` from nextjs-project)
- [ ] nestjs-project builds successfully (`docker compose exec nestjs-api npm run build`)

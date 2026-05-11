# Phase 03 — Upload e Processamento de Vídeos — Progress

**Status:** completed
**SIs:** 9/9 completed

### SI-03.1 — Infrastructure: MinIO, Redis, and Config Namespaces
- **Status:** completed
- **Tests:** no tests
- **Observations:** minio healthcheck uses `mc ready local` — works with minio/mc image. createbuckets container logs confirm both buckets created successfully.

### SI-03.2 — Storage Module
- **Status:** completed
- **Tests:** 6/6 passed (storage.module.spec.ts + storage.service.integration-spec.ts)
- **Observations:** nestjs_modules volume ficou corrompido após npm install manual — removido e recriado limpo via docker compose down/up.

### SI-03.3 — Video Entity and Migration
- **Status:** completed
- **Tests:** 7/7 passed (video.entity.integration-spec.ts + videos.module.spec.ts)
- **Observations:** none

### SI-03.4 — Upload Endpoint
- **Status:** completed
- **Tests:** 7/7 unit+integration passed + 3/3 E2E passed (videos.service.spec.ts + videos.service.integration-spec.ts + test/videos.e2e-spec.ts)
- **Observations:** nanoid v3 (CJS) used instead of v5 (ESM) to avoid dynamic import issues in Jest. JwtAuthGuard removed from controller since it's already an APP_GUARD global. All pre-existing integration tests updated to DELETE videos before channels due to new FK constraint. Two pre-existing test failures fixed (env.validation.spec.ts missing MINIO fields, app.config.spec.ts missing APP_URL fixture value).

### SI-03.5 — Processing Queue (BullMQ)
- **Status:** completed
- **Tests:** 6/6 passed (queue.module.spec.ts + videos.service.spec.ts + videos.service.integration-spec.ts + videos.module.spec.ts)
- **Observations:** @nestjs/bullmq and bullmq installed in container. videos.module.spec.ts uses overrideModule(QueueModule).useModule(MockQueueModule) to avoid Redis connection in unit tests. queue.module.spec.ts calls module.close() to prevent open handles.

### SI-03.6 — Video Worker
- **Status:** completed
- **Tests:** 6/6 passed (video-processor.service.spec.ts + worker.module.spec.ts)
- **Observations:** fluent-ffmpeg must use default import (`import ffmpeg from 'fluent-ffmpeg'`) not namespace import; `jest.mock('fs')` requires spreading `jest.requireActual('fs')` to preserve `fs.native` used by path-scurry (TypeORM dependency); `.on('end', resolve)` needs wrapping as `.on('end', () => resolve())` due to fluent-ffmpeg callback signature; Dockerfile.dev updated with `ffmpeg` apt install; video-worker service added to docker-compose.yml.

### SI-03.7 — Streaming, Thumbnail, and Download Endpoints
- **Status:** completed
- **Tests:** 8/8 unit passed (videos.service.spec.ts) + 6/6 E2E passed (videos-streaming.e2e-spec.ts)
- **Observations:** getThumbnailStream and getDownloadStream added to VideosService to avoid controller accessing private dependencies. E2E test simulates worker by setting video status to READY via SQL after upload. Public routes use @Public() decorator.

### SI-03.8 — Frontend Upload Page
- **Status:** completed
- **Tests:** 4/4 unit passed (upload-form.test.tsx) + 3/3 E2E passed (e2e/videos/upload.spec.ts)
- **Observations:** userEvent.upload in @testing-library/user-event v14 respects the `accept` attribute — file type must match `video/*` even for error-path tests. isInitialized flag added to auth store to distinguish uninitialized from unauthenticated state. (protected) route group with client layout used for auth guard redirect.

### SI-03.9 — Frontend Video Watch Page
- **Status:** completed
- **Tests:** 5/5 unit passed (video-player.test.tsx) + 2/2 E2E passed (e2e/videos/watch.spec.ts)
- **Observations:** Controller had `import { Response } from 'express'` which caused TS1272 compile error with emitDecoratorMetadata + isolatedModules — fixed to `import type { Request, Response } from 'express'`. Watch page shows Processing state when video is not READY (since worker isn't running in E2E). VideoPlayer uses NEXT_PUBLIC_API_URL for client-side stream/thumbnail/download URLs. Server-side fetch uses BACKEND_URL (Docker internal). `<video>` element has no ARIA role — queried with container.querySelector in tests.

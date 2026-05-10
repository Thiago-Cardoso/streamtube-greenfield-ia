# Phase 02 — Cadastro, Login e Gerenciamento de Conta — Progress

**Status:** completed
**SIs:** 18/18 completed

### SI-02.1 — Dependencies, Configuration Namespaces, and Docker Compose
- **Status:** completed
- **Tests:** no tests
- **Observations:** compose.yaml e .env.example já estavam corretos de sessão anterior. Criados auth.config.ts e mail.config.ts, atualizado env.validation.ts e app.module.ts. Instaladas 272 dependências.

### SI-02.2 — Global ValidationPipe and Domain Exception Filter
- **Status:** completed
- **Tests:** 8/8 passing (domain-exception.filter.spec.ts, validation-exception.filter.spec.ts)
- **Observations:** none

### SI-02.3 — User and Channel Entities
- **Status:** completed
- **Tests:** 10/10 passing (user.entity.integration-spec.ts: 5, channel.entity.integration-spec.ts: 4, users.module.spec.ts: 1)
- **Observations:** Migration gerada com uuid_generate_v4(). users.module.spec.ts usa postgres real (DI wiring com TypeOrmModule.forFeature não pode ser testado sem conexão real).

### SI-02.4 — RefreshToken and VerificationToken Entities
- **Status:** completed
- **Tests:** 10/10 passing (refresh-token.entity.integration-spec.ts: 5, verification-token.entity.integration-spec.ts: 5)
- **Observations:** FK violation entre suites ao deletar users — corrigido incluindo todas as tabelas de token no beforeEach de cada spec. Ambas as specs incluem todos os 4 entities para synchronize correto.

### SI-02.5 — Mail Module and Email Templates
- **Status:** completed
- **Tests:** 4/4 passing (mail.service.integration-spec.ts: 3, mail.module.spec.ts: 1)
- **Observations:** HandlebarsAdapter import path é @nestjs-modules/mailer/adapters/handlebars.adapter (via exports map), não o path direto /dist/adapters/. Mailpit API usada em /api/v1/messages para verificar entregas.

### SI-02.6 — User Registration with Automatic Channel Creation
- **Status:** completed
- **Tests:** 29/29 passing — nickname.util.spec: 9, auth.service.spec: 5, users.service.integration-spec: 7, auth.service.integration-spec: 3, auth.e2e-spec: 5
- **Observations:** UsersService deve ser declarado em providers e exports do UsersModule (omitido na spec original). Dynamic import não funciona no Jest sem --experimental-vm-modules — usar rejects.toMatchObject. Todos os beforeEach devem incluir DELETE de verification_tokens e refresh_tokens antes de channels/users para evitar FK violation.

### SI-02.7 — Email Confirmation (Confirm and Resend)
- **Status:** completed
- **Tests:** 27/27 passing — auth.service.spec: 8 novos (total 13), auth.service.integration-spec: 2 novos (total 5), auth.e2e-spec: 6 novos (total 11)
- **Observations:** TypeORM ignores null literal in where clause — IsNull() de typeorm gera IS NULL correto. E2E confirm-email usa endpoint POST para SI-02.7 (será mudado para GET em SI-02.17).

### SI-02.8 — Login with Credential Validation and Token Issuance
- **Status:** completed
- **Tests:** 39/39 passing — auth.service.spec: 14 (3 login unit), auth.service.integration-spec: 7 (2 login integration), auth.module.spec: 1, auth.e2e-spec: 17 (5 login E2E)
- **Observations:** argon2.verify throws TypeError on malformed hash — wrapped in try/catch to treat as invalid credentials. Integration spec must override authConfig.KEY provider with jwtSecret='test-secret' so JWT is signed with test secret (not env var). Mock for EmailNotConfirmedException test needs real argon2 hash of 'anypassword' so verify passes before is_confirmed check.

### SI-02.9 — JWT Access Token Guard
- **Status:** completed
- **Tests:** 27/27 passing — jwt-auth.guard.spec: 6, auth.e2e-spec: 21 (4 guard E2E tests added)
- **Observations:** Added GET /auth/me as protected endpoint for E2E guard testing. @Public() added to AppController.getHello(). APP_GUARD registered in AuthModule providers.

### SI-02.10 — Refresh Token Rotation
- **Status:** completed
- **Tests:** 34/34 passing — auth.service.spec: 18 (4 refresh unit), auth.service.integration-spec: 9 (2 refresh integration), auth.e2e-spec: 25 (4 refresh E2E)
- **Observations:** Grace period path rotates the sibling token in the same family rather than returning an old raw token (hash-only storage makes raw token retrieval impossible). Added findById to UsersService for user email lookup during rotation.

### SI-02.11 — Logout and Session Revocation
- **Status:** completed
- **Tests:** 37/37 passing — auth.service.spec: 19 (1 logout unit), auth.service.integration-spec: 10 (1 logout integration), auth.e2e-spec: 27 (2 logout E2E)
- **Observations:** none

### SI-02.12 — Password Reset (Request and Execute)
- **Status:** completed
- **Tests:** 48/48 passing — auth.service.spec: 24 (5 password reset unit), auth.service.integration-spec: 12 (2 password reset integration), auth.e2e-spec: 33 (6 password reset E2E)
- **Observations:** E2E reset-password tests use DB hash lookup for token since raw token goes through email (Mailpit). Tests cover validation and error paths thoroughly.

### SI-02.13 — Rate Limiting on Auth Endpoints
- **Status:** completed
- **Tests:** 35/35 E2E passing — auth-throttle.e2e-spec: 2 new tests (real 11-request throttle test)
- **Observations:** ThrottlerGuard registered via @UseGuards(ThrottlerGuard) on AuthController (not APP_GUARD) — this is the only way overrideGuard() works in E2E tests for nested module guards. APP_GUARD registration makes overrideGuard/overrideModule impossible to apply from nested module scope. The main auth.e2e-spec.ts uses overrideGuard(ThrottlerGuard) to bypass throttle during long test suites.

### SI-02.14 — TypeScript Compilation Error Fixes
- **Status:** completed
- **Tests:** no tests
- **Observations:** Fixed TS1272 (import type for JwtPayload in auth.controller.ts), TS2322 (IsNull() for used_at in e2e spec), env.validation.spec.ts missing JWT secrets, channel.entity.integration-spec.ts FK ordering.

### SI-02.15 — ChannelsModule Extraction, Nickname Ownership, and Pre-Check Refactor
- **Status:** completed
- **Tests:** 22 new passing (channels/nickname.util.spec: 9, channels/channels.service.spec: 5, channels/channels.service.integration-spec: 3, channels/channels.module.spec: 1, users/users.service.integration-spec: 6 updated, users/users.module.spec: 1 updated) — total 114 unit/integration + 35 E2E
- **Observations:** Dynamic import (await import()) doesn't work in Jest — used static import for ChannelsService in users.service.integration-spec.ts. user.entity.integration-spec.ts needed refresh_tokens/verification_tokens cleanup added. auth.service.integration-spec.ts needed ChannelsModule added to provide ChannelsService for UsersService DI.

### SI-02.16 — Migration Runner Integration Test
- **Status:** completed
- **Tests:** 2/2 passing (migrations.integration-spec.ts)
- **Observations:** Must drop verification_tokens_type_enum before running migrations — other integration specs use synchronize:true which creates the enum; the migration tries to CREATE TYPE again and fails. Added explicit DROP TYPE in beforeAll.

### SI-02.17 — Fix confirm-email Endpoint: POST → GET with Query Token
- **Status:** completed
- **Tests:** 35/35 E2E passing (updated auth.e2e-spec.ts: GET /auth/confirm-email with .query({ token }))
- **Observations:** none

### SI-02.18 — Mail Template Asset Copying
- **Status:** completed
- **Tests:** no tests
- **Observations:** Added assets entry to nest-cli.json: { "include": "mail/templates/**/*.hbs", "watchAssets": true }. Also fixed migration.integration-spec.ts afterAll to re-run migrations after undoLastMigration so E2E tests find a complete DB schema.

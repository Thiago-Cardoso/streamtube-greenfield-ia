# Phase 02 (Frontend) — Cadastro, Login e Gerenciamento de Conta

## Objective

Initialize the Next.js frontend project and deliver the complete Phase 02 authentication screens — registration, login, email confirmation, and password recovery — consuming the Phase 02 NestJS API.

---

## Step Implementations

### SI-FE-02.1 — Next.js Project Initialization and Tooling Setup

**Description:** Initialize the `nextjs-project` directory with Next.js 15 (App Router, TypeScript, Tailwind CSS), configure Prettier, install shadcn/ui, set up the testing stack (Vitest + React Testing Library + Playwright), and establish the project folder structure and environment variable baseline.

**Technical actions:**

- Run `npx create-next-app@latest nextjs-project --typescript --tailwind --eslint --app --src-dir --turbopack --import-alias "@/*"` at the monorepo root — creates `nextjs-project/` with App Router in `src/app/`, TypeScript strict mode, Tailwind v4, and ESLint preconfigured
- Configure Prettier: add `prettier@^3`, `prettier-plugin-tailwindcss@^0.6`, and `eslint-config-prettier@^9` as dev dependencies; create `.prettierrc` with `{ "singleQuote": true, "semi": true, "plugins": ["prettier-plugin-tailwindcss"] }` and `.prettierignore`; add `"format"` and `"format:check"` scripts to `package.json`
- Initialize shadcn/ui: run `npx shadcn@latest init` inside `nextjs-project/` — choose `Default` style, `neutral` base color, and CSS variables; this creates `src/components/ui/` and `src/lib/utils.ts` with `cn()` helper. Install initial components: `npx shadcn@latest add button input label form card`
- Install and configure the testing stack: `vitest@^2`, `@vitejs/plugin-react@^4`, `@testing-library/react@^16`, `@testing-library/user-event@^14`, `@testing-library/jest-dom@^6` as dev dependencies; create `vitest.config.ts` with `environment: 'jsdom'` and `setupFiles: ['./vitest.setup.ts']`; create `vitest.setup.ts` importing `@testing-library/jest-dom`; add `"test"` and `"test:watch"` scripts; install `@playwright/test@^1` and run `npx playwright install --with-deps chromium`; add `"test:e2e"` script pointing to Playwright; create `playwright.config.ts` with `baseURL: 'http://localhost:3003'` and webServer config starting Next.js on port 3003
- Create the project folder structure under `src/`: `app/` (routing), `components/ui/` (shadcn), `components/` (custom), `hooks/` (custom hooks), `lib/` (utilities), `store/` (Zustand stores), `types/` (shared TypeScript types); create `src/types/auth.ts` with `User { id: string; email: string }` and `AuthState` interfaces; create `.env.local.example` with `NEXT_PUBLIC_API_URL=http://localhost:3000` (NestJS backend URL) — note the Next.js dev server must run on port 3003 (`next dev -p 3003`) to match the backend's `APP_URL` default

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/lib/utils.test.ts` | Unit | `cn()` merges Tailwind classes correctly |

**Dependencies:** None

**Acceptance criteria:**

- `npm run dev` starts the Next.js app on port 3003 and `http://localhost:3003` returns the default landing page (HTTP 200)
- `npx tsc --noEmit` exits with code 0 from the `nextjs-project/` directory
- `npm run lint` passes with no errors
- `npm test` runs Vitest and the `cn()` utility test passes
- `npx shadcn@latest add button` succeeds — shadcn/ui is properly configured and adds components to `src/components/ui/`
- `npm run test:e2e` runs Playwright against `http://localhost:3003` without configuration errors

---

### SI-FE-02.2 — Auth Infrastructure: Store, API Client, and Cookie Proxy

**Description:** Install all auth-related libraries, create the Zustand auth store, implement the typed API client that injects the Bearer token, set up TanStack Query as the global data-fetching layer, and create Next.js Route Handlers that act as an auth proxy — receiving backend credentials, setting the `refresh_token` as an HttpOnly cookie, and returning only the `access_token` to the client.

**Technical actions:**

- Install production dependencies: `@tanstack/react-query@^5`, `zustand@^5`, `zod@^3`, `react-hook-form@^7`, `@hookform/resolvers@^3`; install dev dependency `@tanstack/react-query-devtools@^5`
- Create `src/store/auth.store.ts` — Zustand store using `create<AuthStore>()` with state: `user: User | null`, `accessToken: string | null`; actions: `setAuth(user: User, token: string): void`, `clearAuth(): void`, `setAccessToken(token: string): void`; export `useAuthStore` hook and `getAuthState()` as a direct `useAuthStore.getState` reference for use outside React
- Create `src/lib/api.ts` — typed `apiFetch<T>(path: string, options?: RequestInit): Promise<T>` wrapper that: reads the access token via `getAuthState().accessToken`, sets `Authorization: Bearer <token>` header when present, sets `Content-Type: application/json`, prefixes `path` with `NEXT_PUBLIC_API_URL`, throws a typed `ApiError` class on non-2xx responses (including the `error` and `statusCode` fields from the backend's `{ statusCode, error, message }` format)
- Create `src/app/providers.tsx` — Client Component that wraps children with `<QueryClientProvider client={queryClient}>` (with `QueryClient` configured with `defaultOptions.queries.retry: false`) and `<ReactQueryDevtools />` (dev only); add this `<Providers>` component to `src/app/layout.tsx` wrapping `{children}`
- Create Next.js Route Handlers under `src/app/api/auth/` (note: `cookies()` is async in Next.js 15 — always `await cookies()`): 
  - `login/route.ts` — `POST`: receives `{ email, password }`, forwards to backend `POST /auth/login`, on success sets HttpOnly cookie named `refresh_token` via `(await cookies()).set('refresh_token', value, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 60 * 60, path: '/' })`, returns `NextResponse.json({ access_token })`; on error, forwards the backend error status and body
  - `refresh/route.ts` — `POST`: reads cookie via `(await cookies()).get('refresh_token')`, forwards token value to backend `POST /auth/refresh` body, updates the cookie with the new `refresh_token` from the response, returns `{ access_token }`; if cookie missing, returns 401
  - `logout/route.ts` — `POST`: receives `Authorization` header, forwards to backend `POST /auth/logout`; deletes the cookie via `(await cookies()).delete('refresh_token')`; returns 204
- Create `src/app/auth/layout.tsx` — minimal Server Component auth layout (centered card container, no main navbar) shared by all routes under `/auth/*` (register, login, confirm-email, forgot-password, reset-password)

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/store/auth.store.test.ts` | Unit | `setAuth` sets user and token; `clearAuth` resets to null; `setAccessToken` updates token only |
| `src/lib/api.test.ts` | Unit | Injects Bearer header when token present; omits header when no token; throws `ApiError` on non-2xx |

**Dependencies:** SI-FE-02.1

**Acceptance criteria:**

- `useAuthStore()` returns `{ user: null, accessToken: null }` on initial render
- After `setAuth(user, token)`, `getAuthState().accessToken` returns the correct token
- `POST /api/auth/login` with valid credentials: returns `{ access_token }` in the body and sets the `refresh_token` HttpOnly cookie in the `Set-Cookie` response header
- `POST /api/auth/refresh` without the `refresh_token` cookie returns 401
- `POST /api/auth/refresh` with a valid `refresh_token` cookie returns a new `{ access_token }` and updates the cookie
- `POST /api/auth/logout` deletes the `refresh_token` cookie (cookie is absent in subsequent requests)

---

### SI-FE-02.3 — Registration Screen

**Description:** Implement the `/auth/register` page with a registration form (email + password + confirm password), client-side validation via React Hook Form + Zod, and a TanStack Query mutation that calls the backend `POST /auth/register`. On success, renders an inline "check your email" confirmation message.

**Technical actions:**

- Create `src/app/auth/register/page.tsx` — Server Component that renders the `<RegisterForm>` Client Component
- Create `src/components/auth/register-form.tsx` — Client Component using `useForm<RegisterFormValues>` with `zodResolver(registerSchema)`. Zod schema: `email` (`z.string().email()`), `password` (`z.string().min(8).max(128)`), `confirmPassword` (`z.string()`) with `.refine((data) => data.password === data.confirmPassword, { path: ['confirmPassword'] })`. Fields use shadcn/ui `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, `FormMessage`, and `Input`
- Implement the mutation in `register-form.tsx` using `useMutation` from TanStack Query: mutationFn calls `apiFetch('POST /auth/register', { email, password })` directly on the backend (no proxy needed for registration); on success, set a local `submitted` state to render a success message ("Check your email...") instead of the form; on error, map domain error codes: `EMAIL_ALREADY_EXISTS` → display inline error on the email field using `form.setError('email', ...)`; validation errors → display per-field messages

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/components/auth/register-form.test.tsx` | Component | Renders fields; submit with empty fields shows validation errors; `EMAIL_ALREADY_EXISTS` error shows on email field; successful mutation shows success message |
| `e2e/auth/register.spec.ts` | E2E | Full registration flow: valid data → success message; duplicate email → error |

**Dependencies:** SI-FE-02.2

**Acceptance criteria:**

- Submitting the registration form with a missing email or password shorter than 8 characters shows field-level validation errors without calling the API
- Submitting with non-matching passwords shows a "passwords do not match" error on the confirmPassword field
- Successful registration (201 from backend) replaces the form with a "check your email" success message
- Submitting with an already-registered email displays `EMAIL_ALREADY_EXISTS` on the email field inline
- Form submit button shows a loading state while the mutation is pending

---

### SI-FE-02.4 — Login Screen and Session Initialization

**Description:** Implement the `/auth/login` page with a login form that calls the Next.js proxy `POST /api/auth/login`, stores the returned access token in the Zustand store on success, and redirects to `/`. Also implement a `<AuthInitializer>` component in the root layout that silently attempts a token refresh on app load to rehydrate the session from the HttpOnly cookie.

**Technical actions:**

- Create `src/app/auth/login/page.tsx` — Server Component rendering `<LoginForm>` inside the auth layout card
- Create `src/components/auth/login-form.tsx` — Client Component with `useForm<LoginFormValues>` and zodResolver. Zod schema: `email` (`z.string().email()`), `password` (`z.string().min(1)`). Mutation calls `POST /api/auth/login` via `apiFetch`; on success: call `setAuth(user, access_token)` (user data is decoded from the JWT payload or fetched via a `GET /users/me` endpoint — use JWT decode via `jwtDecode` from the `jwt-decode` package to extract `{ sub, email }` without a roundtrip); then use `router.push('/')`. Error mapping: `INVALID_CREDENTIALS` → generic error message on the password field; `EMAIL_NOT_CONFIRMED` → message with a "resend confirmation email" link to `/auth/resend-confirmation`; install `jwt-decode@^4` for access token payload extraction
- Create `src/components/auth/auth-initializer.tsx` — Client Component that runs once on mount: if `useAuthStore().accessToken` is null, calls `POST /api/auth/refresh`; on success, decodes the access token JWT and calls `setAuth(user, access_token)` — silently initializes the session if a valid refresh token cookie exists; on failure, calls `clearAuth()`. Add `<AuthInitializer />` to `src/app/layout.tsx` inside `<Providers>` so it runs on every full page load
- Create `src/app/auth/resend-confirmation/page.tsx` — simple page with an email form that calls backend `POST /auth/resend-confirmation` and shows a success message

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/components/auth/login-form.test.tsx` | Component | Valid submit calls `/api/auth/login`; `INVALID_CREDENTIALS` shows inline error; `EMAIL_NOT_CONFIRMED` shows resend link |
| `src/components/auth/auth-initializer.test.tsx` | Component | On mount with no token, calls refresh; on success, sets auth state; on failure, calls clearAuth |
| `e2e/auth/login.spec.ts` | E2E | Valid credentials → redirects to `/`; wrong password → inline error; unconfirmed email → resend link |

**Dependencies:** SI-FE-02.2

**Acceptance criteria:**

- Visiting `/auth/login` with an existing session (valid refresh token cookie) — after `<AuthInitializer>` runs, `getAuthState().accessToken` is non-null
- Submitting the login form with valid credentials sets the Zustand auth state and navigates to `/`
- Submitting with wrong credentials shows `INVALID_CREDENTIALS` inline without clearing the email field
- Submitting with an unconfirmed account shows a message with a link to resend the confirmation email
- The form submit button is disabled and shows a loading indicator while the mutation is pending

---

### SI-FE-02.5 — Email Confirmation Screen

**Description:** Implement the `/auth/confirm-email` page that reads the `?token=` query parameter (from the link in the confirmation email), calls the backend `GET /auth/confirm-email?token=xxx`, and shows a loading, success, or error state accordingly. Also implement the resend confirmation form for expired/invalid tokens.

**Technical actions:**

- Create `src/app/auth/confirm-email/page.tsx` — Server Component that reads `searchParams.token` and passes it to the `<EmailConfirmation>` Client Component; if no token in URL, render an "invalid link" error state immediately
- Create `src/components/auth/email-confirmation.tsx` — Client Component using `useQuery` from TanStack Query: `queryFn` calls `apiFetch('GET /auth/confirm-email?token=<token>')` directly on the backend; `enabled: !!token`; renders three states: loading (spinner), success (success card with link to `/auth/login`), error — map domain codes: `INVALID_TOKEN` → "This link is invalid or has already been used" + resend form; `TOKEN_EXPIRED` → "This link has expired" + resend form
- Create `src/components/auth/resend-confirmation-form.tsx` — Client Component with a single email input and submit button; mutation calls backend `POST /auth/resend-confirmation`; on response (always 204), shows "If your email is registered and unconfirmed, a new link has been sent"

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/components/auth/email-confirmation.test.tsx` | Component | Loading state while query pending; success state on 204; `INVALID_TOKEN` shows resend form; `TOKEN_EXPIRED` shows resend form |
| `e2e/auth/confirm-email.spec.ts` | E2E | Valid token in URL → success message; invalid token → error + resend form |

**Dependencies:** SI-FE-02.2

**Acceptance criteria:**

- Visiting `/auth/confirm-email?token=<valid-token>` shows a loading spinner, then a success confirmation message with a link to the login page
- Visiting `/auth/confirm-email?token=<invalid-token>` shows the error state with a resend form
- Visiting `/auth/confirm-email` without a `?token=` parameter immediately shows an "invalid link" error (no API call made)
- The resend form submits `POST /auth/resend-confirmation` and shows the neutral success message regardless of backend response (no email existence leakage)

---

### SI-FE-02.6 — Password Recovery Screens

**Description:** Implement the forgot-password page (`/auth/forgot-password`) with an email form that triggers `POST /auth/forgot-password`, and the reset-password page (`/auth/reset-password`) that reads `?token=` from the URL and renders a new-password form calling `POST /auth/reset-password`.

**Technical actions:**

- Create `src/app/auth/forgot-password/page.tsx` — Server Component rendering `<ForgotPasswordForm>` inside the auth layout card
- Create `src/components/auth/forgot-password-form.tsx` — Client Component with a single email field (`z.string().email()`); mutation calls backend `POST /auth/forgot-password`; on success (always 204), replace form with a neutral "If this email is registered, you will receive a reset link" message
- Create `src/app/auth/reset-password/page.tsx` — Server Component reading `searchParams.token`; renders `<ResetPasswordForm token={token} />` or an "invalid link" error if token is missing
- Create `src/components/auth/reset-password-form.tsx` — Client Component with `newPassword` (`z.string().min(8).max(128)`) and `confirmPassword` fields with cross-field `.refine()` validation; mutation calls backend `POST /auth/reset-password` with `{ token, new_password: newPassword }`; on success: show "Password updated" message with link to login; error mapping: `INVALID_TOKEN` → "Invalid or already-used token" with link to `/auth/forgot-password`; `TOKEN_EXPIRED` → "Token expired" with same link; validation errors → per-field messages

**Tests:**

| File | Layer | Verifies |
|------|-------|----------|
| `src/components/auth/forgot-password-form.test.tsx` | Component | Valid email submits mutation; success shows neutral message; invalid email format shows validation error |
| `src/components/auth/reset-password-form.test.tsx` | Component | Matching passwords submits mutation; mismatching shows confirmPassword error; `TOKEN_EXPIRED` shows link to forgot-password |
| `e2e/auth/password-recovery.spec.ts` | E2E | Forgot-password → neutral success message; reset-password with valid token → success; expired token → error message |

**Dependencies:** SI-FE-02.2

**Acceptance criteria:**

- `POST /auth/forgot-password` always shows the neutral "if registered" message — whether or not the email exists in the backend
- Submitting the forgot-password form with an invalid email format shows a validation error without calling the API
- Visiting `/auth/reset-password?token=<valid-token>` and submitting a valid new password shows the success message
- Visiting `/auth/reset-password` without a token renders an "invalid link" error immediately
- Non-matching passwords in the reset form show a validation error on the `confirmPassword` field
- `INVALID_TOKEN` and `TOKEN_EXPIRED` errors on the reset form include a link back to `/auth/forgot-password`

---

## Technical Specifications

### API Contracts — Next.js Route Handlers (auth proxy)

These endpoints are called by the browser. They proxy to the NestJS backend and manage the HttpOnly `refresh_token` cookie. The backend API contracts are defined in `docs/phases/phase-02-auth.md`.

#### POST /api/auth/login (SI-FE-02.2)

**Request body:**
- email: string, required
- password: string, required

**Response 200:**
- access_token: string (JWT)

**Response headers:**
- Set-Cookie: `refresh_token=<jwt>; HttpOnly; Secure; SameSite=Lax; Max-Age=604800; Path=/`

**Error responses:**
- Forwards backend error status and body unchanged (401 INVALID_CREDENTIALS, 403 EMAIL_NOT_CONFIRMED, 400 validation error)

---

#### POST /api/auth/refresh (SI-FE-02.2)

**Request:** No body — reads `refresh_token` from HttpOnly cookie automatically sent by browser

**Response 200:**
- access_token: string (new JWT)

**Response headers:**
- Set-Cookie: updated `refresh_token` cookie

**Error responses:**
- 401: when `refresh_token` cookie is absent or backend rejects it (TOKEN_EXPIRED, TOKEN_REUSE_DETECTED, INVALID_TOKEN)

---

#### POST /api/auth/logout (SI-FE-02.2)

**Request headers:**
- Authorization: Bearer <access_token>

**Response 204:** No content. Clears `refresh_token` cookie.

**Error responses:**
- 401: when access token is missing or invalid

---

### Authorization Matrix

All auth screens in Phase 02 are public — no authentication required to access them. Client-side redirect of already-authenticated users (e.g., away from `/auth/login`) is deferred to Phase 07 when protected routes and a full navigation structure are introduced.

| Route | Public | Notes |
|-------|--------|-------|
| /auth/register | ✓ | |
| /auth/login | ✓ | |
| /auth/confirm-email | ✓ | Token in query string from email link |
| /auth/resend-confirmation | ✓ | |
| /auth/forgot-password | ✓ | |
| /auth/reset-password | ✓ | Token in query string from email link |
| /api/auth/login | ✓ | Route Handler proxy |
| /api/auth/refresh | ✓ | Uses HttpOnly cookie, no Bearer required |
| /api/auth/logout | ✓ (requires valid access token) | Access token validated by backend |

---

## Dependency Map

```
SI-FE-02.1 (no deps)
└── SI-FE-02.2 (auth infrastructure, API client, Route Handlers, auth layout)
    ├── SI-FE-02.3 (register screen)
    ├── SI-FE-02.4 (login screen + AuthInitializer)
    ├── SI-FE-02.5 (email confirmation screen)
    └── SI-FE-02.6 (password recovery screens)
```

SI-FE-02.3, SI-FE-02.4, SI-FE-02.5, and SI-FE-02.6 are fully independent of each other and can be implemented in parallel after SI-FE-02.2.

---

## Deliverables

- [ ] Next.js 15 project initialized in `nextjs-project/` with App Router, TypeScript, Tailwind CSS v4, ESLint, Prettier
- [ ] shadcn/ui configured with Button, Input, Label, Form, Card components
- [ ] Testing stack configured: Vitest + React Testing Library (unit/component) + Playwright (E2E)
- [ ] Zustand auth store (`user`, `accessToken`, `setAuth`, `clearAuth`)
- [ ] TanStack Query v5 global provider in root layout
- [ ] Typed API client (`apiFetch`) with Bearer token injection and typed `ApiError`
- [ ] Next.js Route Handlers for auth cookie proxy (`/api/auth/login`, `/api/auth/refresh`, `/api/auth/logout`)
- [ ] `<AuthInitializer>` component that silently rehydrates the session from the HttpOnly cookie on app load
- [ ] Registration screen at `/auth/register` with React Hook Form + Zod validation
- [ ] Login screen at `/auth/login` with Zustand state update on success
- [ ] Email confirmation screen at `/auth/confirm-email?token=xxx` (matches backend email link format)
- [ ] Resend confirmation form at `/auth/resend-confirmation`
- [ ] Forgot-password screen at `/auth/forgot-password` with neutral success message
- [ ] Reset-password screen at `/auth/reset-password?token=xxx` (matches backend email link format)
- [ ] Minimal auth layout (`src/app/auth/layout.tsx`) shared by all auth pages
- [ ] `NEXT_PUBLIC_API_URL` env var configured; Next.js dev server runs on port 3003 (matching backend `APP_URL` default)
- [ ] All unit/component tests pass (`npm test` in `nextjs-project/`)
- [ ] E2E tests pass (`npm run test:e2e` in `nextjs-project/`)
- [ ] TypeScript compilation clean (`npx tsc --noEmit` exits with code 0 in `nextjs-project/`)
- [ ] `npm run lint` passes with no errors in `nextjs-project/`

# Technical Decisions — Phase 02 (Frontend): Cadastro, Login e Gerenciamento de Conta

> **Phase:** 02 — Frontend (Next.js): Cadastro, Login e Gerenciamento de Conta
> **Status:** Finalized
> **Date:** 2026-05-09

---

## TD-01: Next.js Router Strategy

**Context:** The Next.js project is not yet initialized. The router strategy defines the architecture for all subsequent frontend phases. The App Router (Next.js 13+) and Pages Router are both supported but follow fundamentally different paradigms. Phase 02 requires protected routes, layout-level session checks, and auth-specific screens.

**Options:**

### Option A: App Router
- File-system routing in the `/app` directory using React Server Components, layouts, and Server Actions. Streaming, Suspense boundaries, and co-located data fetching are first-class.
- **Pros:** Production-stable and the recommended path for all new Next.js projects (2024+). Server Actions eliminate the need for separate API routes for auth mutations. Server Components naturally enforce access control at the layout level. Future-proof — Pages Router is in maintenance mode.
- **Cons:** Larger mental model: requires understanding the server/client component boundary. Third-party library compatibility must be checked (most major libraries now support App Router).

### Option B: Pages Router
- File-system routing in the `/pages` directory. All components are client components by default. Data fetching via `getServerSideProps` / `getStaticProps`.
- **Pros:** Simpler mental model. Mature ecosystem with established patterns for auth (`getServerSideProps` + cookies). Familiar to developers with prior Next.js experience.
- **Cons:** No longer receiving major features — maintenance mode only. Cannot use React Server Components or Server Actions. No native layout-level auth guards (must replicate in every page). Harder to hire for going forward.

**Recommendation:** **Option A (App Router)** — The project is greenfield in 2026; there is no migration cost. App Router is the official recommended path and unlocks Server Actions for auth mutations, layout-level session checks without `getServerSideProps` duplication, and better streaming support for Phase 05 (video player). The one-time learning cost is worth the long-term architectural gains.

**Decision:** A (App Router)

---

## TD-02: CSS/Styling Approach

**Context:** The frontend needs to render a YouTube-like interface with many interactive components (video cards, player, sidebar, modals). The styling approach affects bundle size, developer experience, and compatibility with Server Components.

**Options:**

### Option A: Tailwind CSS
- Utility-first CSS framework. All styles are generated statically — zero runtime JavaScript. v4 (Oxide engine) is Rust-based for near-instant rebuilds.
- **Pros:** Zero runtime overhead (all CSS in static file). Perfect for Server Components (no client-side style injection). Native compatibility with shadcn/ui (TD-03). Massive ecosystem of YouTube-style UI examples and components. Fastest iteration for card grids, sidebars, and player layouts.
- **Cons:** Class-heavy markup (mitigated by component composition). Requires familiarity with utility class names.

### Option B: CSS Modules
- Locally scoped CSS, built into Next.js — zero extra dependencies.
- **Pros:** Familiar CSS patterns. No runtime overhead. Works with Server Components.
- **Cons:** More verbose for complex UIs with many states. No utility-class ecosystem for common patterns. Slower iteration for YouTube-scale interfaces.

### Option C: styled-components (CSS-in-JS)
- Write CSS in JavaScript template literals, scoped to components.
- **Pros:** Dynamic theming, component-level encapsulation.
- **Cons:** ~30 KB runtime overhead injected on client. Incompatible with React Server Components without special workarounds. Not recommended for App Router projects.

**Recommendation:** **Option A (Tailwind CSS)** — For a YouTube-like interface, Tailwind's utility-first approach enables rapid iteration across video cards, grid layouts, sidebars, and player controls. Zero runtime cost and native shadcn/ui compatibility are decisive. CSS-in-JS (Option C) is incompatible with App Router's Server Component model.

**Decision:** A (Tailwind CSS)

---

## TD-03: UI Component Library

**Context:** Phase 02 requires form components (inputs, buttons, error messages) and Phase 05–06 will need dialogs, dropdowns, and interactive elements. The component library choice shapes the visual identity and development velocity for all remaining phases.

**Options:**

### Option A: shadcn/ui
- Unstyled, accessible components built on Radix UI primitives, styled with Tailwind CSS. Components are copied into the project (you own the source code).
- **Pros:** Full design control — no library-imposed visual style. Zero lock-in (code is in your repo). Built for Tailwind, App Router, and modern React. Excellent accessibility via Radix primitives. ~30 components cover all Phase 02–06 needs (Form, Button, Dialog, Dropdown, Avatar, etc.).
- **Cons:** Must manually pull upstream updates. No enterprise-grade DataGrid or Charts out of the box (not needed until Phase 07 at earliest).

### Option B: MUI (Material UI)
- Comprehensive component library (~70+ components) with Material Design. Enterprise-grade theming and MUI X for advanced components.
- **Pros:** Most complete out-of-the-box. Excellent documentation. Professional enterprise support available.
- **Cons:** Heaviest bundle. Opinionated Material Design aesthetics — overriding for a YouTube-like look requires significant theming work. Complex theming system. Less compatible with Tailwind CSS.

### Option C: Chakra UI
- Props-based styling with built-in accessibility. Medium component count.
- **Pros:** Excellent developer experience. Accessibility-first. Intuitive API.
- **Cons:** Relies on CSS-in-JS runtime — problematic for App Router Server Components. v3 rework still maturing.

### Option D: Radix UI Primitives only (no shadcn/ui)
- Headless, completely unstyled primitives. Full control with Tailwind.
- **Pros:** Minimal dependency surface. Complete customization.
- **Cons:** Build every component from scratch — high time cost for Phase 02's form needs.

**Recommendation:** **Option A (shadcn/ui)** — For a YouTube-like platform, shadcn/ui provides the right balance: accessible primitives, zero visual lock-in, and Tailwind compatibility. It covers all components needed through Phase 07. The open-source model and rapid community growth ensure long-term viability. MUI's Material Design aesthetic would require heavy overriding that costs more effort than shadcn/ui's component ownership model.

**Decision:** A (shadcn/ui)

---

## TD-04: HTTP Client for API Calls

**Context:** Phase 02 auth flows involve login, registration, token refresh, and email confirmation — all mutations. The HTTP client must handle JWT access token injection into headers, automatic token refresh on 401, and both server-side (SSR) and client-side fetching. The backend uses refresh token rotation, so concurrent refresh requests require careful handling.

**Options:**

### Option A: TanStack Query v5 (React Query)
- Data synchronization library with caching, background refetching, and mutation primitives. v5 adds full TypeScript inference and official Suspense support.
- **Pros:** Superior mutation handling — `useMutation` with `onSuccess`/`onError` callbacks, automatic cache invalidation, and retry logic. DevTools for debugging query/cache state. Handles concurrent refresh request race conditions via stale-while-revalidate. Official Suspense support aligns with App Router streaming. ~12KB bundle.
- **Cons:** Requires a `QueryClientProvider` wrapper (client-side only). Server Components must use native fetch directly; TanStack Query is for Client Components.

### Option B: SWR v2
- Vercel's data-fetching hook library. Lightweight (~4KB gzipped). `useSWRMutation` added in v2 for mutations.
- **Pros:** Smallest bundle. Tight Next.js/Vercel integration. Zero-config ISR support. Simple API for read-heavy use cases.
- **Cons:** Mutation API (`useSWRMutation`) is shallower than TanStack Query — fewer callbacks, less cache control. No DevTools. Cache invalidation after auth mutations is more manual.

### Option C: Axios + custom hooks
- HTTP client library with interceptors. Build custom hooks for auth token injection and refresh.
- **Pros:** Familiar API. Interceptor pattern is well-suited for token refresh injection.
- **Cons:** No built-in caching, background refetching, or mutation state management — must build manually. Duplicates what TanStack Query provides.

**Recommendation:** **Option A (TanStack Query v5)** — The backend's refresh token rotation strategy requires careful client-side mutation orchestration: a 401 triggers a refresh, then retries the original request. TanStack Query's mutation lifecycle hooks and cache invalidation simplify this considerably. For Server Components, use native `fetch` (no library needed — RSC data fetching is straightforward). TanStack Query handles Client Component mutations and cache synchronization.

**Decision:** A (TanStack Query v5)

---

## TD-05: Auth Token Storage on Client

**Context:** The backend issues a JWT access token (short-lived, 15min) and an opaque refresh token (JWT-formatted, stored in DB for rotation, longer-lived). Depends on TD-01 (router strategy) since HttpOnly cookie handling differs between App Router middleware and Pages Router `getServerSideProps`.

**Options:**

### Option A: HttpOnly Cookie (refresh token) + In-Memory React state (access token)
- Backend sets the refresh token as an HttpOnly, Secure, SameSite=Lax cookie. The short-lived access token is stored in React state (Zustand or Context). On app load, a silent refresh call rehydrates the access token using the cookie.
- **Pros:** Strongest XSS protection — JavaScript cannot read the HttpOnly refresh token. CSRF protected via SameSite=Lax. Access token in memory means logout is instant. Aligns precisely with the backend's refresh token rotation design.
- **Cons:** Requires a silent refresh on every page load to rehydrate the access token. Next.js middleware can check the cookie to protect routes server-side.

### Option B: HttpOnly Cookies for both access and refresh tokens
- Backend sets both tokens as HttpOnly cookies. Next.js middleware reads the access token cookie server-side to validate sessions.
- **Pros:** Simpler client-side code — no in-memory state. Server Components can validate auth without client-side JS.
- **Cons:** Access token in cookie means it's sent with every request (slight overhead). Logout requires explicit cookie deletion. Token rotation responses must update both cookies.

### Option C: localStorage (both tokens)
- Store both tokens in `localStorage`. Inject access token into request headers manually.
- **Pros:** Persists across page reloads without a server roundtrip. Simplest client-side implementation.
- **Cons:** Vulnerable to XSS attacks — any injected script can steal both tokens. Not acceptable for an application with user accounts and private content. OWASP explicitly recommends against JWT storage in localStorage.

**Recommendation:** **Option A (HttpOnly Cookie + In-Memory Access Token)** — This matches the backend's design intent: the refresh token is the long-lived secret and must be inaccessible to JavaScript. The access token's 15-minute lifetime limits XSS damage if exposed. The silent refresh pattern is a one-time setup cost that produces a secure, production-ready auth flow. Option C (localStorage) is ruled out on security grounds.

**Decision:** A (HttpOnly Cookie + In-Memory)

---

## TD-06: Form Handling

**Context:** Phase 02 requires four auth forms: registration (email, password, confirm password), login (email, password), password reset request (email), and password redefinition (new password, confirm). The library must handle validation, error display, and submission state.

**Options:**

### Option A: React Hook Form
- Uncontrolled component-based form library. Minimal re-renders via subscription model. ~12KB minified+gzipped. Integrates natively with shadcn/ui's `Form` component (which wraps React Hook Form).
- **Pros:** Best performance (fewest re-renders on keystroke). Smallest bundle. Active maintenance. Native shadcn/ui Form integration avoids wrapper boilerplate. Excellent TypeScript support via `useForm<T>()`. Pairs cleanly with Zod via `@hookform/resolvers`.
- **Cons:** Uncontrolled component mental model differs from standard React controlled inputs — slight learning curve.

### Option B: Formik
- Component-based form library (`<Formik>`, `<Field>`, `<ErrorMessage>`). Controlled inputs.
- **Pros:** Explicit, imperative API. Comprehensive documentation.
- **Cons:** 44KB bundle (3.5× React Hook Form). More re-renders per keystroke. No significant updates since 2022 — declining community and maintenance. More boilerplate.

### Option C: Native React state (useState)
- Build forms with `useState` per field, manual validation functions.
- **Pros:** Zero dependencies.
- **Cons:** High boilerplate for validation, error display, submission state, and touched states. Not scalable beyond trivial forms.

**Recommendation:** **Option A (React Hook Form)** — shadcn/ui's `Form` component is a React Hook Form wrapper; choosing Option A means zero extra integration cost. The Zod `@hookform/resolvers` package gives schema-based validation with TypeScript inference for free. Formik's maintenance trajectory rules it out for a greenfield project.

**Decision:** A (React Hook Form)

---

## TD-07: Global Auth State Management

**Context:** The authenticated user's session (current user object, access token, loading state) must be accessible across the app — navbar avatar, protected route guards, API request headers. The state must be initialized on page load via a silent refresh and updated on login/logout.

**Options:**

### Option A: Zustand
- Minimal, hook-based store. ~1KB minified+gzipped. No boilerplate, no reducers, no context providers.
- **Pros:** Simplest API for auth state: `useAuthStore()` returns user, token, setUser, logout. Selective subscriptions prevent unnecessary re-renders. Zero context provider wrapping needed. Excellent TypeScript support.
- **Cons:** Less structured than Redux — teams without discipline can misuse it.

### Option B: React Context API
- Built into React. `AuthContext` provides user and token to the component tree.
- **Pros:** Zero dependencies. Familiar to all React developers.
- **Cons:** Causes all context consumers to re-render on any state change (even unrelated fields). Requires a `useReducer` for complex state transitions. Not a true state manager — optimized for stable, infrequently-changing values (e.g., theme, locale).

### Option C: Redux Toolkit
- Structured, opinionated state management with DevTools, middleware, and time-travel debugging. ~10KB.
- **Pros:** Enforced structure at scale. Excellent DevTools. Battle-tested for large teams.
- **Cons:** Overkill for auth state alone. Slice/reducer/action boilerplate adds friction for a 3-store app. Worth considering only at 10+ developer team scale.

**Recommendation:** **Option A (Zustand)** — The auth state for Phase 02 is simple: current user, access token, loading flag. Zustand handles this in ~20 lines with no boilerplate. Context API's re-render behavior is problematic when the access token updates on every silent refresh — Zustand's selective subscription model avoids unnecessary renders in the video player (Phase 05) and comments (Phase 06). Redux Toolkit is architectural overkill.

**Decision:** A (Zustand)

---

## Decisions Summary

| ID | Decision | Recommendation | Choice |
|----|----------|---------------|--------|
| TD-01 | Next.js Router Strategy | App Router | A (App Router) |
| TD-02 | CSS/Styling Approach | Tailwind CSS | A (Tailwind CSS) |
| TD-03 | UI Component Library | shadcn/ui | A (shadcn/ui) |
| TD-04 | HTTP Client for API Calls | TanStack Query v5 | A (TanStack Query v5) |
| TD-05 | Auth Token Storage on Client | HttpOnly Cookie (refresh) + In-Memory (access) | A (HttpOnly Cookie + In-Memory) |
| TD-06 | Form Handling | React Hook Form | A (React Hook Form) |
| TD-07 | Global Auth State Management | Zustand | A (Zustand) |

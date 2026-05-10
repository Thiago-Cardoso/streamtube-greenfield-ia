# Phase 02 (Frontend) — Cadastro, Login e Gerenciamento de Conta — Progress

**Status:** completed
**SIs:** 6/6 completed

### SI-FE-02.1 — Next.js Project Initialization and Tooling Setup
- **Status:** completed
- **Tests:** 4/4 passed (src/lib/utils.test.ts)
- **Observations:** Next.js 16.2.6 installed (not 15). Breaking changes noted: middleware.ts renamed to proxy.ts, searchParams/params are fully async (no sync fallback), Turbopack enabled by default. jsdom must be installed separately as Vitest peer dep. shadcn/ui 4.7.0 uses @base-ui/react instead of @radix-ui.

### SI-FE-02.2 — Auth Infrastructure: Store, API Client, and Cookie Proxy
- **Status:** completed
- **Tests:** 9/9 passed (auth.store.test.ts: 5, api.test.ts: 4)
- **Observations:** shadcn/ui v4 form component has no files in registry — form fields will be built manually with RHF + shadcn primitives in subsequent SIs.

### SI-FE-02.3 — Registration Screen
- **Status:** completed
- **Tests:** 6/6 passed (src/components/auth/register-form.test.tsx)
- **Observations:** `export * from '@testing-library/react'` in test-utils/render.tsx conflicted with the local `render` export at runtime, causing RTL's unwrapped render to be used instead of the QueryClientProvider-wrapped one. Fixed by using named re-exports instead of star re-export.

### SI-FE-02.4 — Login Screen and Session Initialization
- **Status:** completed
- **Tests:** 8/8 passed (login-form.test.tsx: 4, auth-initializer.test.tsx: 4)
- **Observations:** `vi.stubGlobal` returns the old global value, not the new spy — capture the `vi.fn()` before passing it to `stubGlobal` when you need to assert on calls.

### SI-FE-02.5 — Email Confirmation Screen
- **Status:** completed
- **Tests:** 4/4 passed (src/components/auth/email-confirmation.test.tsx)
- **Observations:** TanStack Query v5 disallows `undefined` as query data. `apiFetch` returns `undefined` for 204; fixed by adding `.then(() => true as const)` in the queryFn so the query always resolves to a non-undefined value on success.

### SI-FE-02.6 — Password Recovery Screens
- **Status:** completed
- **Tests:** 8/8 passed (forgot-password-form.test.tsx: 4, reset-password-form.test.tsx: 4)
- **Observations:** `getByLabelText(/new password/i)` ambiguously matched both "New password" and "Confirm new password" labels. Use exact string `'New password'` when labels have common substrings.

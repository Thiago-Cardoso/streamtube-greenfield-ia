import * as fs from 'fs';
import * as path from 'path';

const BACKEND_URL = process.env.BACKEND_URL_TEST ?? 'http://localhost:3100';
const MAILPIT_URL = process.env.MAILPIT_URL ?? 'http://localhost:8026';

const RUN_ID = Date.now();

const USERS = {
  login: { email: `e2e.login.${RUN_ID}@test.local`, password: 'Password123!' },
  reset: { email: `e2e.reset.${RUN_ID}@test.local`, password: 'Password123!' },
} as const;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function register(email: string, password: string): Promise<void> {
  const res = await fetch(`${BACKEND_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`Register failed for ${email}: ${JSON.stringify(body)}`);
  }
}

async function extractTokenFromEmail(toEmail: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt++) {
    const listRes = await fetch(`${MAILPIT_URL}/api/v1/messages?limit=50`);
    if (!listRes.ok) { await sleep(500); continue; }

    const list = await listRes.json() as {
      messages?: Array<{ ID: string; To: Array<{ Address: string }> }>;
    };

    const msg = list.messages?.find((m) =>
      m.To.some((t) => t.Address === toEmail),
    );

    if (msg) {
      const detailRes = await fetch(`${MAILPIT_URL}/api/v1/message/${msg.ID}`);
      const detail = await detailRes.json() as { Text?: string; HTML?: string };
      const body = detail.Text ?? detail.HTML ?? '';
      const urlMatch = body.match(/href="([^"]*token=[^"]+)"/);
      if (urlMatch) {
        const token = new URL(urlMatch[1]).searchParams.get('token');
        if (token) return token;
      }
      const plainMatch = body.match(/\/auth\/[a-z-]+\?token=([^\s<]+)/);
      if (plainMatch) return decodeURIComponent(plainMatch[1]);
    }

    await sleep(500);
  }
  throw new Error(`Token email not found for ${toEmail} after 10s`);
}

async function clearMailbox(): Promise<void> {
  await fetch(`${MAILPIT_URL}/api/v1/messages`, { method: 'DELETE' }).catch(() => {});
  await sleep(100);
}

export default async function globalSetup() {
  console.log('\n[e2e:setup] Seeding test data...');

  // Login test user (email confirmation not required for login)
  await clearMailbox();
  await register(USERS.login.email, USERS.login.password);
  console.log(`  ✓ login user: ${USERS.login.email}`);

  // Reset-password test: register user, then request reset token
  await clearMailbox();
  await register(USERS.reset.email, USERS.reset.password);
  await fetch(`${BACKEND_URL}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: USERS.reset.email }),
  });
  const resetToken = await extractTokenFromEmail(USERS.reset.email);
  console.log('  ✓ reset token obtained');

  const state = {
    confirmedUser: USERS.login,
    resetToken,
  };

  fs.writeFileSync(
    path.join(__dirname, 'test-state.json'),
    JSON.stringify(state, null, 2),
  );

  console.log('[e2e:setup] Done.\n');
}

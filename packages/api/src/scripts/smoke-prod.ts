// Smoke test against a deployed API. Hits /health, /me with seeded creds,
// creates and deletes a throwaway group. Exits non-zero on any failure.
//
// Required env:
//   API_URL (defaults to http://localhost:3000)
//   SMOKE_ACCESS_TOKEN (a valid bearer token for a seeded throwaway user)
//
// Run:
//   pnpm --filter @rivals/api exec tsx src/scripts/smoke-prod.ts

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const TOKEN = process.env.SMOKE_ACCESS_TOKEN;

async function check(label: string, res: Response, expected = [200, 201, 204]) {
  if (!expected.includes(res.status)) {
    const body = await res.text();
    throw new Error(`[smoke] ${label} → ${res.status}: ${body}`);
  }
  console.info(`[smoke] ✓ ${label} → ${res.status}`);
  return res;
}

async function jsonOrText(res: Response) {
  const text = await res.text();
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return text;
  }
}

async function main() {
  if (!TOKEN) throw new Error('SMOKE_ACCESS_TOKEN missing');

  // 1. health
  const health = await fetch(`${API_URL}/health`);
  await check('GET /health', health);

  // 2. authenticated /me
  const me = await fetch(`${API_URL}/me`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  await check('GET /me', me);

  // 3. create throwaway group
  const groupName = `smoke-${Date.now()}`;
  const created = await fetch(`${API_URL}/groups`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ name: groupName, referenceTz: 'UTC' }),
  });
  await check('POST /groups', created, [201]);
  const group = (await jsonOrText(created)) as { id: string };
  if (typeof group !== 'object' || !group.id) {
    throw new Error('group create response missing id');
  }

  // 4. delete it
  const deleted = await fetch(`${API_URL}/groups/${group.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${TOKEN}` },
  });
  await check('DELETE /groups/:id', deleted, [200, 204]);

  console.info('[smoke] ✅ all checks passed');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

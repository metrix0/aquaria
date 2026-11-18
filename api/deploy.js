import { createHash, timingSafeEqual } from 'node:crypto';

const codePattern = /^[A-Za-z0-9_-]{32,128}$/;
const hookPattern = /^https:\/\/api\.vercel\.com\/v1\/integrations\/deploy\/prj_[A-Za-z0-9]+\/[A-Za-z0-9_-]+$/;

function digest(value) {
  return createHash('sha256').update(value).digest();
}

export async function POST(request) {
  const reply = (status) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });
  const origin = request.headers.get('origin');
  if (origin !== new URL(request.url).origin) return reply(403);

  const code = process.env.AQUARIA_DEPLOY_CODE?.trim() ?? '';
  const hook = process.env.AQUARIA_DEPLOY_HOOK_URL?.trim() ?? '';
  if (!codePattern.test(code) || !hookPattern.test(hook)) return reply(503);

  const authorization = request.headers.get('authorization') ?? '';
  const supplied = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!codePattern.test(supplied) || !timingSafeEqual(digest(supplied), digest(code))) return reply(401);

  try {
    const result = await fetch(hook, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000) });
    if (!result.ok || !(await result.json()).job?.id) return reply(502);
    return reply(202);
  } catch {
    return reply(504);
  }
}

const hookPattern = /^https:\/\/api\.vercel\.com\/v1\/integrations\/deploy\/prj_[A-Za-z0-9]+\/[A-Za-z0-9_-]+$/;

export async function POST(request) {
  const reply = (status) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });
  const origin = request.headers.get('origin');
  if (origin !== new URL(request.url).origin) return reply(403);

  const hook = process.env.AQUARIA_DEPLOY_HOOK_URL?.trim() ?? '';
  if (!hookPattern.test(hook)) return reply(503);

  try {
    const result = await fetch(hook, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000) });
    if (!result.ok || !(await result.json()).job?.id) return reply(502);
    return reply(202);
  } catch {
    return reply(504);
  }
}

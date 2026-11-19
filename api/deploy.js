const hookPattern = /^https:\/\/api\.vercel\.com\/v1\/integrations\/deploy\/prj_[A-Za-z0-9]+\/[A-Za-z0-9_-]+$/;

export async function POST(request) {
  const reply = (status) => new Response(null, { status, headers: { 'Cache-Control': 'no-store' } });
  const origin = request.headers.get('origin');
  if (origin !== new URL(request.url).origin) return reply(403);

  const hook = process.env.AQUARIA_DEPLOY_HOOK_URL?.trim() ?? '';
  if (!hookPattern.test(hook)) return reply(503);

  const requestedAt = Date.now();
  try {
    const result = await fetch(hook, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8000) });
    if (!result.ok) return reply(502);
    const { job } = await result.json();
    if (!job?.id) return reply(502);
    const queuedAt = Number.isSafeInteger(job.createdAt) && job.createdAt > 0 ? job.createdAt : requestedAt;
    return Response.json({ queuedAt }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return reply(504);
  }
}

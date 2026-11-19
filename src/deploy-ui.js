const pendingKey = 'aquaria.deployPending';
const idlePollMs = 30_000;
const deployPollMs = 5_000;
const confirmationWindowMs = 10 * 60_000;

function isTimestamp(value) {
  return Number.isSafeInteger(value) && value > 0 && value <= 8.64e15;
}

function savedDeploy() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(pendingKey));
    if (isTimestamp(saved?.queuedAt) && isTimestamp(saved?.expiresAt)) return saved;
  } catch {
    // The current tab can still track deployments with storage blocked.
  }
  return null;
}

export function createDeployUi(button, age, status, notify) {
  let pending = savedDeploy();
  let buildTime = 0;
  let ageAtCheck = 0;
  let checkedAt = 0;
  let nextCheck = 0;
  let refreshing = false;

  function show(message, { busy = false, done = false } = {}) {
    status.textContent = message;
    status.toggleAttribute('data-done', done);
    button.disabled = busy;
  }

  function rememberDeploy(deploy) {
    pending = deploy;
    try {
      if (deploy) sessionStorage.setItem(pendingKey, JSON.stringify(deploy));
      else sessionStorage.removeItem(pendingKey);
    } catch {
      // Tracking carries on for this page.
    }
  }

  function buildAge(now) {
    return ageAtCheck + (now - checkedAt);
  }

  function updateAge(now) {
    if (!buildTime) return;
    const seconds = Math.floor(buildAge(now) / 1000);
    const elapsed = seconds >= 3600 ? Math.floor(seconds / 3600) + 'h'
      : seconds >= 60 ? Math.floor(seconds / 60) + 'min' : seconds + 's';
    const label = 'Last deploy ' + elapsed + ' ago';
    if (age.textContent !== label) age.textContent = label;
  }

  async function refreshBuild() {
    if (refreshing || document.hidden) return;
    refreshing = true;
    try {
      const response = await fetch('/deploy-info.json', { cache: 'no-cache', signal: AbortSignal.timeout(5000) });
      if (!response.ok) return;
      const { builtAt } = await response.json();
      if (!isTimestamp(builtAt)) return;

      const now = performance.now();
      const serverDate = Date.parse(response.headers.get('date'));
      const cacheAge = Number(response.headers.get('age'));
      const cachedFor = Number.isFinite(cacheAge) ? Math.max(0, cacheAge) * 1000 : 0;
      const serverTime = Number.isFinite(serverDate) ? serverDate + cachedFor : Date.now();
      ageAtCheck = Math.max(0, serverTime - builtAt, builtAt === buildTime ? buildAge(now) : 0);
      checkedAt = now;
      buildTime = builtAt;
      age.dateTime = new Date(builtAt).toISOString();
      updateAge(now);
      age.hidden = false;
    } catch {
      // Keep the existing age and retry on the next poll.
    } finally {
      if (pending && buildTime >= pending.queuedAt) {
        rememberDeploy(null);
        show('Done', { done: true });
      } else if (pending && Date.now() >= pending.expiresAt) {
        rememberDeploy(null);
        show('Could not confirm deploy');
      }
      refreshing = false;
      nextCheck = performance.now() + (pending ? deployPollMs : idlePollMs);
    }
  }

  if (pending) show('Deploying…', { busy: true });
  void refreshBuild();
  window.setInterval(() => {
    const now = performance.now();
    updateAge(now);
    if (now >= nextCheck) void refreshBuild();
  }, 1000);

  button.addEventListener('click', async () => {
    if (button.disabled) return;
    const requestedAt = Date.now();
    const previousBuildTime = buildTime;
    show('Queuing…', { busy: true });
    try {
      const response = await fetch('/api/deploy', { method: 'POST', signal: AbortSignal.timeout(12000) });
      if (response.status === 504) {
        show('Could not confirm deploy');
        notify('Could not confirm the request. Check Vercel before retrying.');
        return;
      }
      if (response.status === 202) {
        const { queuedAt } = await response.json().catch(() => ({})) ?? {};
        rememberDeploy({
          queuedAt: Math.max(previousBuildTime + 1, isTimestamp(queuedAt) ? queuedAt : requestedAt),
          expiresAt: Date.now() + confirmationWindowMs,
        });
        show('Deploying…', { busy: true });
        void refreshBuild();
        return;
      }
      show('Deploy failed');
      if (response.status === 503) notify('Vercel Deploy Hook is missing.');
      else if ([404, 405].includes(response.status)) notify('Deploy is unavailable here.');
      else notify('Vercel could not queue the deployment.');
    } catch {
      show('Could not confirm deploy');
      notify('Could not confirm the request. Check Vercel before retrying.');
    }
  });
}

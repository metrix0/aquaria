import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));

for (const file of await readdir(new URL('src/', root), { recursive: true })) {
  if (!file.endsWith('.js')) continue;
  const result = spawnSync(process.execPath, ['--check', 'src/' + file], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

await rm(dist, { recursive: true, force: true });
await mkdir(new URL('vendor/', dist), { recursive: true });
for (const file of ['index.html', 'style.css', 'src']) {
  await cp(new URL(file, root), new URL(file, dist), { recursive: true });
}
await cp(new URL('node_modules/@supabase/supabase-js/dist/umd/supabase.js', root), new URL('vendor/supabase.js', dist));
await writeFile(new URL('src/build-info.js', dist), 'export const version = ' + JSON.stringify(pkg.version) + ';\n');
const config = {
  url: process.env.AQUARIA_SUPABASE_URL ?? '',
  publishableKey: process.env.AQUARIA_SUPABASE_PUBLISHABLE_KEY ?? '',
};
if (config.publishableKey && !config.publishableKey.startsWith('sb_publishable_')) {
  throw new Error('Aquaria builds accept only a Supabase publishable key.');
}
await writeFile(new URL('src/config.js', dist), 'export const config = ' + JSON.stringify(config) + ';\n');

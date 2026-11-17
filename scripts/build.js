import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));

for (const file of ['game.js', 'world.js', 'render.js']) {
  const result = spawnSync(process.execPath, ['--check', 'src/' + file], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

await rm(dist, { recursive: true, force: true });
await mkdir(new URL('src/', dist), { recursive: true });
for (const file of ['index.html', 'style.css', 'src/game.js', 'src/world.js', 'src/render.js']) {
  await cp(new URL(file, root), new URL(file, dist));
}
await writeFile(new URL('src/version.js', dist), 'export const version = ' + JSON.stringify(pkg.version) + ';\n');

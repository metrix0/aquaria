import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);
const pkg = JSON.parse(await readFile(new URL('package.json', root), 'utf8'));
const devTools = process.argv.includes('--dev') || process.env.VERCEL_ENV === 'preview';

const modules = [
  'src/game.js', 'src/world.js', 'src/render.js', 'src/environment.js', 'src/enemies.js',
  'src/inventory.js', 'src/inventory-ui.js', 'src/character.js', 'src/character-editor.js',
];
for (const file of modules) {
  const result = spawnSync(process.execPath, ['--check', file], {
    cwd: root,
    stdio: 'inherit',
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

await rm(dist, { recursive: true, force: true });
await mkdir(new URL('src/', dist), { recursive: true });
for (const file of ['index.html', 'style.css', ...modules]) {
  await cp(new URL(file, root), new URL(file, dist));
}
await writeFile(new URL('src/build-info.js', dist), [
  'export const version = ' + JSON.stringify(pkg.version) + ';',
  'export const devTools = ' + devTools + ';',
  '',
].join('\n'));

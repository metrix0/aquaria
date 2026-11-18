# Aquaria

Run `npm ci`, then `npm run dev` and open `http://localhost:4173`. Run `npm test` for the simulation and save compatibility checks and `npm run build` to create the Vercel output.

- `src/gameplay/` owns simulation, player movement and gameplay rules. `src/input.js`, `src/ui.js` and `src/render.js` handle browser input and presentation.
- `src/content.js` defines stable content IDs and recipes. `src/world/` generates the base world, and `src/world.js` loads terrain chunks and tracks sparse changes.
- `src/save.js` migrates older browser saves and stores tile edits by world coordinates with a generator version. Solo terrain and personal inventory, harvested resources and equipment are browser saves.
- Online rooms share terrain through versioned Supabase migrations. PostgreSQL stores accepted tile edits with revisions. Realtime carries temporary positions and prompts clients to refresh confirmed edits. A link grants entry to its co-op room.

For multiplayer in a local or preview build, set `AQUARIA_SUPABASE_URL` and `AQUARIA_SUPABASE_PUBLISHABLE_KEY` to a test Supabase instance with the migrations in `supabase/migrations/` applied. Builds without those variables can play solo.

## Manual production deploys

In the Aquaria Vercel project, create a Deploy Hook for `main` under **Settings → Git**. In **Settings → Environment Variables**, add both values as sensitive Production variables:

- `AQUARIA_DEPLOY_HOOK_URL` is the URL from the Deploy Hook.
- `AQUARIA_DEPLOY_CODE` is a random code, for example the output of `openssl rand -hex 32`. Enter this code when using the **Deploy** button in the game.

Deploy `main` manually once from the Vercel dashboard to activate the button and its environment variables. Future button presses queue a deployment of the latest `main`. Git auto-deploy stays disabled.

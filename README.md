# Aquaria

Run `npm ci`, then `npm run dev` and open `http://localhost:4173`. Run `npm test` for the simulation and save compatibility checks and `npm run build` to create the Vercel output.

- `src/gameplay/` owns simulation, player movement and gameplay rules. `src/input.js`, `src/ui.js` and `src/render.js` handle browser input and presentation.
- `src/content.js` defines stable content IDs and recipes. `src/world/` generates the base world, and `src/world.js` loads terrain chunks and tracks sparse changes.
- `src/save.js` migrates older browser saves and stores tile edits by world coordinates with a generator version. Solo terrain and personal inventory, harvested resources and equipment are browser saves.
- Online rooms share terrain through versioned Supabase migrations. PostgreSQL stores accepted tile edits with revisions. Realtime carries temporary positions and prompts clients to refresh confirmed edits. A link grants entry to its co-op room.

For multiplayer in a local or preview build, set `AQUARIA_SUPABASE_URL` and `AQUARIA_SUPABASE_PUBLISHABLE_KEY` to a test Supabase instance with the migrations in `supabase/migrations/` applied. Builds without those variables can play solo.

## Manual production deploys

In the Aquaria Vercel project, create a Deploy Hook for `main` under **Settings → Git** and save the URL as the sensitive Production variable `AQUARIA_DEPLOY_HOOK_URL`. Deploy `main` manually once to activate the environment variable.

Anyone playing the production build can click **Deploy** to queue a Vercel release of the latest `main`. Git auto-deploy stays disabled.

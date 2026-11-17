# Aquaria working rules

Aquaria is a 2D browser game in `metrix0/aquaria` with Vercel as its deployment target.

## Scope and implementation

- Start with the closest existing implementation. Read the relevant files and callers, then reuse the established components, styles, and behavior. Keep the diff focused and preserve unrelated behavior and data.
- For bug fixes, verify the failure before editing when possible. Fix the underlying cause and recheck the affected flow. For investigations, inspect the relevant code, state, and logs and report what you verified.
- Keep new code and assets near the feature they serve. Keep simulation and input logic separate from rendering and menu UI where practical. Keep user-facing text focused on what the player needs to know or do.

## Git and versioning

- Work from the current `main` by default. Before editing and before committing, verify the remote branch head and reread affected files if it moved. Incorporate concurrent work, resolve conflicts, and rerun affected checks. Never force-push.
- Deliver one focused commit per task with a descriptive message. When the first playable release is ready, start at `0.1.0`. Use semantic versions and matching Git tags for releases. Keep the app version in one source of truth and keep documentation-only commits out of the release version.
- Verify the commit, project, and environment before a Vercel deployment. Use the existing Git deployment workflow once configured and check the deployment for the exact commit when applicable.

## Validation

- Run the relevant existing checks and production build when the project provides them. For gameplay or UI changes, test the affected flow in a headless browser at applicable desktop and mobile sizes. Check supported inputs, resizing, and reload behavior where relevant.
- Report the commit hash, changed files, and checks actually run. Include an affected page or preview URL when available and call out any validation that remains pending.

## Supabase

- Once Aquaria’s Supabase project is connected, verify the project identity before making database changes. Keep preview and test writes out of production data.
- Keep privileged keys server-side and store credentials in environment variables. Use a publishable key for browser access and enable row-level security with least-privilege policies on exposed tables.
- Keep schema changes in versioned migrations. Review compatibility with existing clients and saved data, and validate against a local or test database before applying to production.

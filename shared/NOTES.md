# Scaffold notes and VERIFY outcomes

Checked on 20 Nov 2026 against Rayfin 2.0.0 (`@microsoft/rayfin-*@2.0.0`, the installed package docs under
`node_modules/@microsoft/*/assets/docs`, and the generated agent guide in `AGENTS.md` / `.agents/skills`), and by
deploying a skeleton app from this monorepo to a real Fabric workspace (F4 capacity, Australia East).

## VERIFY outcomes (spec section 2)

| # | Question | Outcome |
|---|----------|---------|
| 1 | Number types | **Exist.** `@int()` and `@decimal()` are in `@microsoft/rayfin-core` 2.0 (`decorators.md`). Use `@int` for counts, scores and durations. |
| 2 | Enums | **Exist.** `@set('a', 'b', ...)` declares a string enum. Use it for status/kind columns, and keep a matching TypeScript union plus a client-side check. |
| 3 | Hybrid projects (SQL + connector) | **Supported.** `rayfin.yml` takes `services.data` and a `connectors:` array side by side; the client registers `data: dataService()` and `connectors: connectorsService(...)` in one `RayfinClient.create`. Measure Unit Tests and Model Explainer have the connector added (`rayfin connector add`). Connectors do not run under `rayfin dev`: only after `rayfin up`. |
| 4 | Live updates | **No subscriptions/realtime** in the SDK. Live screens poll every 5 s with `usePolling` (pauses while the tab is hidden). |
| 5 | Charts | The 2.0 `dataapp` template ships no chart components (only an empty-state preview). Charts use Recharts through `@x10/shared/charts` (bar, stacked bar, line, scatter, heatmap) with theme-aware colours and a screen-reader summary. |
| – | Claims | `session.user` exposes `id` (the `sub` claim), `email` and an optional `name`. Row policies can use `claims.sub`, `claims.email` and `claims.role`. Person.displayName defaults to `name`, then the email prefix, and is editable. |
| – | Roles | Only the built-in `anonymous` and `authenticated` roles. There is no admin role or claim: admin-only actions are enforced in the app's domain functions (both modes) and, where possible, with row policies on denormalised owner columns (e.g. `hostSub` copied onto child rows). Full database-level admin enforcement would need dynamic auth claims (`udf.authClaims`) — out of scope, listed under Later. |
| – | Anonymous | Not used. Anonymous data access needs a tenant setting; every entity uses `authenticated`. |

## Platform facts learned by deploying

- Deploy works non-interactively with an Azure CLI token: `RAYFIN_TOKEN=$(az account get-access-token --resource https://api.fabric.microsoft.com --query accessToken -o tsv) npx rayfin up --workspace-id <ws> --item-name <name> --yes`. It creates three items (AppBackend, SQLDatabase, SQLEndpoint), applies the schema, uploads `dist/`, and appends the hosting URL to `allowedRedirectUris` in `rayfin.yml`.
- Deploying from inside this npm-workspaces monorepo works (hoisted `node_modules`).
- **Table names are pluralised**: `Todo` → `dbo.Todos`, `Person` → `dbo.People`. Columns keep the property names. `id` defaults to `newid()`.
- **Always give `@text` a `max`.** Without it the column is `nvarchar(max)`, which the guide says can break the generated GraphQL schema.
- Optional fields on entity classes are typed `field?: T` (the 2.0 decorator typings reject `T | null`). In the app types (`src/model.ts`) optional values are `T | null`.
- Collection queries return one page (100 rows) unless paged. `createRayfinStore` pages with `.first(500).executePaginated()` until done. `count()` is not available.
- The data client returns dates as `Date | string`, booleans possibly as `'true' | 'false'`, decimals possibly as strings. `readRow` normalises everything: dates become ISO strings.
- Fabric static hosting is protected (sign-in page in front of the app). Sign-in in a standalone tab opens a popup (`ensureSignedInWithFabric`); embedded in the Fabric portal it is silent (`initEmbeddedAuth`).
- Deep links use `HashRouter` (`/#/suites/123`), so no server rewrite rules are needed on static hosting.
- Semantic model metadata: `INFO.TABLES()` / `INFO.MEASURES()` fail through Execute Queries on this tenant; `INFO.VIEW.TABLES()`, `INFO.VIEW.MEASURES()`, `INFO.VIEW.COLUMNS()`, `INFO.VIEW.RELATIONSHIPS()` work. Columns come back named `[Name]`, `[Table]`, `[IsHidden]`, … (bracketed).
- The connector result (2.0) is column-aligned: `{ status: 'success', table: { columns: [{ name, dataType }], rows: unknown[][] } }` or `{ status: 'error', error: { category: 'api'|'query'|'network'|'overflow'|'unknown', message } }`. `executeQuery` accepts `resultSetRowCountLimit`.
- `rayfin connector invoke` (CLI direct path) returned 401 with an Azure CLI token; the deployed app path goes through the platform function under the signed-in user instead, and is what counts.
- All ten apps deployed on 20 Nov 2026 with every row policy accepted by the platform, including: per-action `@role` lists with `include`/`exclude`, `.or(...)` policies (author or host), policies that compare a field to a literal (`item.status.eq('new')`), and `unique` field options.
- Connector config accepts `${MODEL_WORKSPACE_ID}` / `${MODEL_ITEM_ID}` placeholders resolved from the environment at `rayfin up`, so model ids stay out of the repo (`tools/deploy-app.mjs --model-workspace-id … --model-item-id …`).
- A connector-only app (`services.data.enabled: false`, no `rayfin/data`) deploys fine (Model Explainer).
- **What the Fabric bundle contains.** `rayfin env` writes `VITE_RAYFIN_API_URL` (its path includes the tenant and workspace ids) and the publishable key (`pk-…`, designed to be public) into `.env.local`, and Vite inlines them in the built JavaScript. Every Rayfin app works this way; neither is a secret and the API still requires Fabric sign-in. They are never committed (`.env*`, `dist/` and `rayfin/.deployments.json` are gitignored). `rayfin up` also appends the app's hosting URL to `allowedRedirectUris` in `rayfin.yml`; that hostname contains no ids.
- Demo semantic model: `tools/demo-model/` builds "X10 Retail Demo Model" (calculated tables only, no data source) in the workspace through the Fabric REST API. `INFO.VIEW.MEASURES()` returns `Expression` as null on this tenant, so Model Explainer shows a note instead of expressions for live models.
- **Capacity sizing.** Deploying all ten apps (ten SQL databases) and seeding them twice within about an hour pushed an
  F4 capacity into throttling: hosting and the API answered `429 CapacityLimitExceeded`, and SQL logins failed with
  "Validation of user's permissions failed". Nothing was wrong with the apps; the capacity recovers as the overage burns
  down. For a workshop with all ten apps live, use F8 or larger, or spread the apps over two capacities, and deploy in
  small batches. Before the 429 stage, Fabric applies **interactive delay**: every request (even an unauthenticated
  401 from static hosting) is held for about 20 seconds after the connection opens. Measure it with
  `curl -s -o /dev/null -w "%{time_connect} %{time_total}\n" <app url>`: a fast connect and a ~21 s total means throttling.
  The shared Rayfin store now times out each SDK call after 60 s (`REQUEST_TIMEOUT_MS`), so a throttled capacity shows
  an error with Retry instead of a spinner, and a 429 shows as category `capacity` with a plain message.
- **Live check, 20 Nov 2026 (Chrome, signed in through Fabric SSO).** All ten apps load behind the Fabric sign-in gate
  and read their seeded data. Model Explainer read the X10 Retail Demo Model through the deployed connector (5 tables,
  21 columns, 6 measures, 4 relationships). Measure Unit Tests ran its suite through the connector: 5 pass, the 2025
  plan case fails by -8.61%, the renamed measure returns the model's DAX error, as seeded. A host pin and unpin in
  Workshop Live Q&A saved under the `hostSub` row policy. `UQ_PulseSessions_code` exists in Cohort Pulse's database,
  so `@text({ unique: true })` creates a real unique constraint.
- **After scaling to F16 (20 Nov 2026).** The overage carried over from F4 kept the interactive delay for about ten
  minutes, then cleared. All ten apps were redeployed with the request timeout; a host pin and unpin each took about
  0.6 s. The capacity was then paused: the apps are unavailable until it is resumed
  (`az resource invoke-action -g <rg> -n <capacity> --resource-type Microsoft.Fabric/capacities --action resume`).
- Seed ownership: `tools/seed-fabric.mjs --admin-email you@org.com` maps the first persona (the admin/host in every app) to your real Person row, so you own the rows that persona owns and can edit them under the row policies. `--reset` removes previously seeded rows first (demo items only).

## Conventions (every app)

- **Data access only through `DataStore`** (`@x10/shared/data`): `store.repo('Entity').list({ where, orderBy, limit })`, `get`, `create`, `update`, `remove`. Equality filters only; filter further in memory. Never call the Rayfin client from components.
- **Domain logic in `src/domain/*.ts`** as pure functions plus thin async functions that take `(store, me, …)`. Permission and rule checks live there and throw `RuleError` / `PermissionError`, so they hold in demo mode and in Fabric. Unit-test every pure function.
- **`src/model.ts`** holds the app types, `limits` (the same numbers as the decorators), and `defs` (field kinds per entity). Keep it in step with `rayfin/data/*.ts`; every entity file is registered in `rayfin/data/schema.ts`.
- **Every entity carries explicit `@role` decorators.** Default: `@role('authenticated', 'read')` plus owner-scoped `create/update/delete` policies (`claims.sub.eq(item.<ownerSubColumn>)`) where the spec says users own rows. Don't name entities after reserved GraphQL types (`Date`, `Query`, …). Plain id columns (`suiteId: @uuid`) instead of `@one/@many` relationships.
- **Seed** in `src/seed.ts`, called through `runSeed` (idempotent via `AppMarker` key `seed:v1`). Dates computed from `ctx.now`. Persona `Person` rows come first; use `ctx.people[i].sub` / `.displayName` as owners. Fictional, generic text only.
- **Demo mode** (`npm run dev`, Playwright, recordings): in-memory store persisted to localStorage, seeded on first load, persona switcher in the identity menu, `?as=<sub>` to open as a persona. A banner says it is demo mode.
- **Fabric mode** (`npx rayfin up` → `build:fabric`): Fabric SSO, Rayfin GraphQL store, Person upsert on first load.
- **UI** from `@x10/shared/ui` and `@x10/shared/charts` (see the UI kit section below). Every async view goes through `useAsync` + `DataState` (loading, empty, error with category and Retry). Refetch after every write.
- **Polling**: `usePolling(reload, 5000)` on live screens.
- **Tests**: Vitest for domain code (`src/**/*.test.ts`), Playwright smoke in `e2e/` (both 390px and 1280px projects run every spec). No test needs a tenant.
- **Ports**: each app's dev/e2e port is fixed in its `package.json` and `playwright.config.ts` (5201–5210).

## UI kit (v2, per docs/DESIGN.md)

Full API: `shared/src/ui/README.md`. Live catalogue: `npm run playground -w shared` (port 5200; `?accent=<name>&theme=dark`).

- **Tokens.** `shared/src/ui/styles.css` + generated `palette.css` (from `palette.ts`, `npm run gen:palette -w shared`;
  `palette.test.ts` asserts every text/solid pair is AA in both themes). 12-step `gray-*` and `accent-*` ramps, ten named
  accent ramps plus `green`/`red`, status `ok|warn|bad|info` × `solid|soft|text|line|contrast`, surfaces (`bg`, `surface`,
  `surface-2`, `surface-sunken`, `surface-raised`), `line`/`line-strong`, `shadow-1|2`, type scale `text-xs…5xl` with
  `text-ui` (13px). v1 names (`--brand`, `--ok`, `text-muted`, `--chart-*`…) still work. Fonts (Geist, Geist Mono,
  Instrument Serif) are self-hosted and imported by the runtime.
- **Accent and logo.** `AppConfig.accent` (indigo, ember, blue, plum, amber, violet, coral, teal, gold, cyan; defaults to
  the DESIGN.md §3 assignment by appId) and `AppConfig.logo` (inline 24×24 SVG, `currentColor`) or `logoPaths`
  (path strings, keeps `app.config.ts` JSX-free). `NavItem.icon` sets the phone tab-bar icon. mountApp sets
  `data-accent` on `<html>`; theme follows the system unless the identity menu forces light or dark.
- **New components.** IconButton, LinkButton/buttonClass, Badge, StatusDot, Tag, Kbd, Tooltip, Popover, Menu, Sheet,
  SegmentedControl, Stat/StatStrip (replace KPI-card rows), Meter, Progress, ProgressRing, AvatarStack, Skeleton,
  Timeline, Countdown, Callout, Table/Th/Td/Tr, List; `@x10/shared/motion` for live re-ordering only.
- **Stage kit (centrepieces).** `<AppShell immersive>` + `StagePage` (alias `ImmersiveLayout`) with slots for title and
  breadcrumb, `topRight` (fly to, `ViewToggle`), `lenses` (`LensBar`, keys 1–9), `legend` (`Legend`), `bottomRight`
  (`ViewAsSwitch`, key V) and `side` (`TodayPanel`; a bottom sheet on phones), plus `FloatingPanel`, `Breadcrumb`,
  `StageMessage`, `useHotkeys`, `useReducedMotion`, `supportsWebGL()` (`?nowebgl` forces the fallback),
  `useThemeColors()` (concrete colours for canvas/three.js) and `--world-*` tokens (sky, ground, structure, water,
  foliage, glow, ink, grid, shadow) in both themes. Apps add their own rendering library; shared has none.
  Print: `.print-only`, `.no-print`.
- **Do:** hierarchy through type and space; one primary object per page; status as dot + label; numbers right-aligned in
  mono; designed loading/empty/error states; sheets and 44px targets on phones; check both themes at 1280 and 390.
- **Don't:** card-in-card or a card per list item; KPI-card rows on every page; instruction paragraphs under headings;
  glyph-prefixed pastel pills; Tailwind default palette or hex colours; `text-brand` for text (use `text-brand-text` or
  `text-accent-11`).

## Seeding a deployed app and making an admin

```bash
node tools/seed-fabric.mjs --app <slug> --admin-email you@yourorg.com
```

Loads the same seed rows into the app's Fabric SQL database (skipped when the marker exists) and sets `isAdmin = 1` on
your Person row (open the app once first so the row exists). The equivalent manual SQL in the Fabric SQL editor is:

```sql
UPDATE dbo.People SET isAdmin = 1 WHERE email = 'you@yourorg.com';
```

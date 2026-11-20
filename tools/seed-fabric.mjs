#!/usr/bin/env node
// Load an app's seed data into its deployed Fabric SQL database, and optionally make someone an admin.
//
//   node tools/seed-fabric.mjs --app <slug> [--workspace-id <ws>] [--item-name <name>] [--admin-email you@org.com] [--dry-run] [--skip-seed]
//
// - Seed rows come from the app's own seed function (shared/scripts/export-seed.ts), with dates relative to now.
// - Idempotent: skipped when dbo.AppMarker already holds key 'seed:v1'. The marker is written last.
// - Table names are resolved from the live database (Rayfin pluralises entity names, e.g. Todo -> Todos).
// - Uses your Azure CLI sign-in for both the Fabric API and the SQL connection. Nothing is stored.
// - Never runs automatically: deployments do not call it.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import sql from 'mssql';

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
const flag = (n) => process.argv.includes(`--${n}`);

const root = resolve(import.meta.dirname, '..');
const slug = arg('app');
if (!slug) {
  console.error('Usage: seed-fabric.mjs --app <slug> [--workspace-id <ws>] [--item-name <name>] [--admin-email <email>] [--dry-run]');
  process.exit(2);
}
const appDir = join(root, 'apps', slug);

let workspaceId = arg('workspace-id');
let itemName = arg('item-name');
if (!workspaceId || !itemName) {
  try {
    const dep = JSON.parse(readFileSync(join(appDir, 'rayfin', '.deployments.json'), 'utf8'));
    const entries = Array.isArray(dep) ? dep : Object.values(dep.deployments ?? dep);
    const last = entries.find((e) => e && (e.workspaceId || e.fabricWorkspaceId)) ?? {};
    workspaceId ??= last.workspaceId ?? last.fabricWorkspaceId;
    itemName ??= last.itemName ?? last.fabricItemName;
  } catch {
    /* fall through */
  }
}
itemName ??= slug;
if (!workspaceId) {
  console.error('No --workspace-id given and none found in rayfin/.deployments.json.');
  process.exit(2);
}

const token = (resource) =>
  execSync(`az account get-access-token --resource ${resource} --query accessToken -o tsv`, { encoding: 'utf8', shell: true }).trim();

console.log(`Exporting seed rows for ${slug}…`);
const exported = JSON.parse(
  execSync(`npx tsx shared/scripts/export-seed.ts apps/${slug}`, { cwd: root, encoding: 'utf8', shell: true, maxBuffer: 64 * 1024 * 1024 }),
);

const fabricToken = token('https://api.fabric.microsoft.com');
const fx = async (path) => {
  const r = await fetch(`https://api.fabric.microsoft.com/v1${path}`, { headers: { Authorization: `Bearer ${fabricToken}` } });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
  return r.json();
};
const db = (await fx(`/workspaces/${workspaceId}/sqlDatabases`)).value.find((d) => d.displayName === itemName);
if (!db) throw new Error(`No SQL database named "${itemName}" in workspace ${workspaceId}. Deploy first with npx rayfin up.`);
const props = (await fx(`/workspaces/${workspaceId}/sqlDatabases/${db.id}`)).properties;
const [server, port] = props.serverFqdn.split(',');
const pool = await sql.connect({
  server,
  port: Number(port || 1433),
  database: props.databaseName,
  options: { encrypt: true },
  authentication: { type: 'azure-active-directory-access-token', options: { token: token('https://database.windows.net/') } },
  requestTimeout: 120000,
});

const tables = (await pool.request().query(`SELECT t.name FROM sys.tables t JOIN sys.schemas s ON s.schema_id=t.schema_id WHERE s.name='dbo'`)).recordset.map((r) => r.name);
const resolveTable = (entity) => {
  const candidates = [entity, `${entity}s`, `${entity}es`, entity.replace(/y$/, 'ies'), entity === 'Person' ? 'People' : null].filter(Boolean);
  const hit = candidates.find((c) => tables.some((t) => t.toLowerCase() === c.toLowerCase()));
  if (!hit) throw new Error(`No table for entity ${entity}. Tables: ${tables.join(', ')}`);
  return tables.find((t) => t.toLowerCase() === hit.toLowerCase());
};

const markerTable = resolveTable('AppMarker');
const peopleTable = resolveTable('Person');
const adminEmailArg = arg('admin-email');

// --reset (demo items only): remove previously seeded rows so the seed can load again. Real users' Person rows stay.
if (flag('reset') && !flag('dry-run')) {
  const personaSubs = new Set((exported.personas ?? []).map((p) => p.sub));
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    for (const entity of Object.keys(exported.tables)) {
      if (entity === 'Person') continue;
      await new sql.Request(tx).query(`DELETE FROM dbo.[${resolveTable(entity)}]`);
    }
    for (const sub of personaSubs) {
      await new sql.Request(tx).input('s', sql.NVarChar, sub).query(`DELETE FROM dbo.[${peopleTable}] WHERE sub = @s`);
    }
    // Seeded Person rows for fictional extras (subs not used by personas) also start with "demo-" or "seed-".
    await new sql.Request(tx).query(`DELETE FROM dbo.[${peopleTable}] WHERE sub LIKE 'demo-%' OR sub LIKE 'seed-%'`);
    await tx.commit();
    console.log('Reset: seeded rows removed.');
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

// --admin-email: the first persona (the admin/host in every app) becomes the real admin, so they own the seeded rows
// that persona owns (suites, sessions, contracts…) and can edit them under the row policies.
if (adminEmailArg && exported.personas?.length) {
  const me = (await pool.request().input('e', sql.NVarChar, adminEmailArg).query(`SELECT TOP 1 sub, displayName FROM dbo.[${peopleTable}] WHERE LOWER(email) = LOWER(@e)`)).recordset[0];
  if (me) {
    const persona = exported.personas[0];
    let swapped = 0;
    for (const [entity, rows] of Object.entries(exported.tables)) {
      const fields = exported.fields[entity];
      exported.tables[entity] = rows
        .filter((r) => !(entity === 'Person' && r.sub === persona.sub))
        .map((r) => {
          const out = { ...r };
          for (const f of Object.keys(fields)) {
            if (out[f] === persona.sub) {
              out[f] = me.sub;
              swapped++;
            } else if (typeof out[f] === 'string' && out[f] === persona.name && /name$/i.test(f)) {
              out[f] = me.displayName;
            }
          }
          return out;
        });
    }
    console.log(`Persona "${persona.name}" mapped to ${adminEmailArg} (${swapped} owner fields).`);
  } else if (!flag('skip-seed')) {
    console.error(`No Person row for ${adminEmailArg} yet. Open the app once while signed in, then run this again.`);
    process.exit(1);
  }
}

const already = (await pool.request().input('k', sql.NVarChar, 'seed:v1').query(`SELECT COUNT(*) n FROM dbo.[${markerTable}] WHERE [key]=@k`)).recordset[0].n;

const typeFor = { uuid: sql.UniqueIdentifier, text: sql.NVarChar, set: sql.NVarChar, int: sql.Int, decimal: sql.Decimal(18, 6), bool: sql.Bit, date: sql.DateTime2 };

if (flag('skip-seed')) {
  // admin-only run
} else if (already) {
  console.log('Seed marker present: seed data already loaded, nothing inserted.');
} else if (flag('dry-run')) {
  for (const [entity, rows] of Object.entries(exported.tables)) console.log(`would insert ${rows.length} into dbo.${resolveTable(entity)}`);
} else {
  const order = Object.keys(exported.tables).filter((e) => e !== 'AppMarker');
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    for (const entity of order) {
      const table = resolveTable(entity);
      const fields = exported.fields[entity];
      const rows = exported.tables[entity];
      for (const row of rows) {
        const req = new sql.Request(tx);
        const cols = Object.keys(fields).filter((f) => row[f] !== undefined && row[f] !== null);
        for (const c of cols) {
          const v = fields[c] === 'date' ? new Date(row[c]) : row[c];
          req.input(c, typeFor[fields[c]] ?? sql.NVarChar, v);
        }
        await req.query(`INSERT INTO dbo.[${table}] (${cols.map((c) => `[${c}]`).join(',')}) VALUES (${cols.map((c) => `@${c}`).join(',')})`);
      }
      console.log(`inserted ${rows.length} into dbo.${table}`);
    }
    await new sql.Request(tx)
      .input('k', sql.NVarChar, 'seed:v1')
      .input('at', sql.DateTime2, new Date())
      .query(`INSERT INTO dbo.[${markerTable}] ([key],[createdAt]) VALUES (@k,@at)`);
    await tx.commit();
    console.log('Seed loaded and marker written.');
  } catch (e) {
    await tx.rollback();
    throw e;
  }
}

const adminEmail = adminEmailArg;
if (adminEmail && !flag('dry-run')) {
  const r = await pool.request().input('e', sql.NVarChar, adminEmail).query(`UPDATE dbo.[${peopleTable}] SET isAdmin = 1 WHERE LOWER(email) = LOWER(@e)`);
  console.log(
    r.rowsAffected[0]
      ? `Admin set for ${adminEmail}.`
      : `No Person row for ${adminEmail} yet. Open the app once while signed in, then run this again with --admin-email.`,
  );
}
await pool.close();

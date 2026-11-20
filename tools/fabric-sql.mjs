#!/usr/bin/env node
// Run T-SQL against an app's Fabric SQL database using the signed-in Azure CLI identity.
//
//   node tools/fabric-sql.mjs --workspace-id <ws> --database <app item name> --query "SELECT TOP 5 * FROM dbo.Person"
//   node tools/fabric-sql.mjs --workspace-id <ws> --database <app item name> --file apps/x/seed/seed.sql
//
// Tokens come from `az account get-access-token`; nothing is stored. Batches are split on lines that read `GO`.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import sql from 'mssql';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i > -1 ? process.argv[i + 1] : undefined;
}

function token(resource) {
  return execSync(`az account get-access-token --resource ${resource} --query accessToken -o tsv`, {
    encoding: 'utf8',
    shell: true,
  }).trim();
}

const workspaceId = arg('workspace-id');
const database = arg('database');
const file = arg('file');
const query = arg('query');
if (!workspaceId || !database || (!file && !query)) {
  console.error('Usage: fabric-sql.mjs --workspace-id <id> --database <name> (--query <sql> | --file <path>)');
  process.exit(2);
}

const fabricToken = token('https://api.fabric.microsoft.com');
const res = await fetch(`https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/sqlDatabases`, {
  headers: { Authorization: `Bearer ${fabricToken}` },
});
if (!res.ok) throw new Error(`Listing SQL databases failed: ${res.status} ${await res.text()}`);
const dbs = (await res.json()).value;
const db = dbs.find((d) => d.displayName === database);
if (!db) {
  console.error(`No SQL database named "${database}". Found: ${dbs.map((d) => d.displayName).join(', ')}`);
  process.exit(1);
}
const detail = await (
  await fetch(`https://api.fabric.microsoft.com/v1/workspaces/${workspaceId}/sqlDatabases/${db.id}`, {
    headers: { Authorization: `Bearer ${fabricToken}` },
  })
).json();
const [server, port] = detail.properties.serverFqdn.split(',');

const pool = await sql.connect({
  server,
  port: Number(port || 1433),
  database: detail.properties.databaseName,
  options: { encrypt: true },
  authentication: {
    type: 'azure-active-directory-access-token',
    options: { token: token('https://database.windows.net/') },
  },
  requestTimeout: 120000,
});

const text = file ? readFileSync(file, 'utf8') : query;
const batches = text
  .split(/^\s*GO\s*$/im)
  .map((b) => b.trim())
  .filter(Boolean);
for (const batch of batches) {
  const result = await pool.request().query(batch);
  for (const rs of result.recordsets ?? []) {
    if (rs.length) console.table(rs);
  }
  if (result.rowsAffected?.some((n) => n > 0)) console.log(`rows affected: ${result.rowsAffected.join(', ')}`);
}
await pool.close();

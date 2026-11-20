/**
 * Run an app's seed against an in-memory store and print the rows as JSON (entity name -> rows).
 * Used by tools/seed-fabric.mjs; never touches a tenant.
 *   npx tsx shared/scripts/export-seed.ts apps/<slug>
 */
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

import { createMemoryStore } from '../src/data/memoryStore';
import { runSeed } from '../src/runtime/seed';

const appDir = process.argv[2];
if (!appDir) {
  console.error('Usage: export-seed.ts <app dir>');
  process.exit(2);
}
const mod = await import(pathToFileURL(resolve(appDir, 'src', 'app.config.ts')).href);
const config = mod.config;
const store = createMemoryStore(config.defs);
await runSeed(store, config.personas, config.seed, new Date());
const tables = store.dump();
const fields = Object.fromEntries(Object.values(config.defs).map((d: unknown) => {
  const def = d as { name: string; fields: Record<string, string> };
  return [def.name, def.fields];
}));
process.stdout.write(JSON.stringify({ appId: config.appId, personas: config.personas, fields, tables }));

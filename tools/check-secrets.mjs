#!/usr/bin/env node
// Fail if tracked files contain tokens, publishable keys, connection strings or tenant/workspace GUIDs.
// Allowed: the all-zero placeholder GUID and the fixed persona ids used by demo seeds.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const files = execSync('git ls-files -co --exclude-standard', { encoding: 'utf8' })
  .split('\n')
  .filter((f) => f && !/\.(png|jpg|gif|mp4|wav|ico|lock)$/i.test(f) && !f.endsWith('package-lock.json'));

const rules = [
  { name: 'JWT / bearer token', re: /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/ },
  { name: 'Rayfin publishable key', re: /\bpk-[A-Za-z0-9]{12,}/ },
  { name: 'connection string', re: /(Password|Pwd)=[^;\s]+/i },
  { name: 'Azure storage key', re: /AccountKey=[A-Za-z0-9+/=]{20,}/ },
  { name: 'GUID (tenant/workspace/item id?)', re: /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i },
];
const allowedGuid = (g) => /^0{8}-0{4}-[0-9]0{3}-[0-9]0{3}-\d{12}$/.test(g) || g === '00000000-0000-0000-0000-000000000000';

let bad = 0;
for (const f of files) {
  let text;
  try {
    text = readFileSync(f, 'utf8');
  } catch {
    continue;
  }
  if (f.endsWith('.project.json')) continue; // create-rayfin telemetry correlation id, meant to be committed
  text.split('\n').forEach((line, i) => {
    for (const r of rules) {
      const m = line.match(r.re);
      if (!m) continue;
      if (r.name.startsWith('GUID') && allowedGuid(m[0])) continue;
      console.log(`${f}:${i + 1}: ${r.name}: ${m[0].slice(0, 16)}…`);
      bad++;
    }
  });
}
if (bad) {
  console.error(`\n${bad} potential secret(s) found.`);
  process.exit(1);
}
console.log(`No secrets found in ${files.length} files.`);

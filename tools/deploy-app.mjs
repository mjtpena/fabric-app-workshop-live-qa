#!/usr/bin/env node
// Deploy one app to Fabric with the signed-in Azure CLI identity, then optionally seed it and make an admin.
//
//   node tools/deploy-app.mjs <slug> --workspace-id <ws> [--item-name <name>] [--seed] [--admin-email you@org.com]
//        [--model-workspace-id <ws> --model-item-id <id>]      (apps with a semantic model connector)
//
// Equivalent to: RAYFIN_TOKEN=$(az account get-access-token --resource https://api.fabric.microsoft.com ...) \
//                npx rayfin up --workspace-id <ws> --item-name <name> --yes
// Connector apps keep the model ids out of the repo: rayfin.yml reads ${MODEL_WORKSPACE_ID} and ${MODEL_ITEM_ID}.
import { execSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const argv = process.argv.slice(2);
const slug = argv.find((a) => !a.startsWith('--') && !argv[argv.indexOf(a) - 1]?.startsWith('--'));
const arg = (n) => {
  const i = argv.indexOf(`--${n}`);
  return i > -1 ? argv[i + 1] : undefined;
};
const flag = (n) => argv.includes(`--${n}`);
const workspaceId = arg('workspace-id') ?? process.env.X10_WORKSPACE_ID;
if (!slug || !workspaceId) {
  console.error('Usage: deploy-app.mjs <slug> --workspace-id <ws> [--item-name <name>] [--seed] [--admin-email <email>] [--model-workspace-id <ws> --model-item-id <id>]');
  process.exit(2);
}
const root = resolve(import.meta.dirname, '..');
const appDir = join(root, 'apps', slug);
if (!existsSync(join(appDir, 'rayfin', 'rayfin.yml'))) throw new Error(`No Rayfin project at ${appDir}`);
const itemName = arg('item-name') ?? slug;

const token = execSync('az account get-access-token --resource https://api.fabric.microsoft.com --query accessToken -o tsv', {
  encoding: 'utf8',
  shell: true,
}).trim();
const env = { ...process.env, RAYFIN_TOKEN: token };
if (arg('model-workspace-id')) env.MODEL_WORKSPACE_ID = arg('model-workspace-id');
if (arg('model-item-id')) env.MODEL_ITEM_ID = arg('model-item-id');

console.log(`Deploying ${slug} as "${itemName}"…`);
const up = spawnSync('npx', ['rayfin', 'up', '--workspace-id', workspaceId, '--item-name', itemName, '--yes'], {
  cwd: appDir,
  env,
  stdio: 'inherit',
  shell: true,
});
if (up.status !== 0) process.exit(up.status ?? 1);

if (flag('seed') || arg('admin-email')) {
  const seedArgs = ['tools/seed-fabric.mjs', '--app', slug, '--workspace-id', workspaceId, '--item-name', itemName];
  if (arg('admin-email')) seedArgs.push('--admin-email', arg('admin-email'));
  if (!flag('seed')) seedArgs.push('--skip-seed');
  const s = spawnSync(process.execPath, seedArgs, { cwd: root, stdio: 'inherit' });
  if (s.status !== 0) process.exit(s.status ?? 1);
}

try {
  const dep = JSON.parse(readFileSync(join(appDir, 'rayfin', '.deployments.json'), 'utf8'));
  const d = dep.deployments?.[dep.active];
  if (d) console.log(`\nLive: ${d.hostingUrl}\nIn Fabric: ${d.fabricDeepLink}`);
} catch {
  /* ignore */
}

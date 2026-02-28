#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const packagePath = path.join(root, 'package.json');
const pluginPath = path.join(root, 'openclaw.plugin.json');

const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const plugin = JSON.parse(fs.readFileSync(pluginPath, 'utf8'));

if (!pkg.version || typeof pkg.version !== 'string') {
  throw new Error('package.json version is missing or invalid');
}

if (plugin.version === pkg.version) {
  console.log(`openclaw.plugin.json already matches version ${pkg.version}`);
  process.exit(0);
}

plugin.version = pkg.version;
fs.writeFileSync(pluginPath, `${JSON.stringify(plugin, null, 2)}\n`);
console.log(`Synced openclaw.plugin.json version -> ${pkg.version}`);

#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { Command } from 'commander';

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as { version: string };

new Command()
  .name('callitto')
  .description('A second life for your words.')
  .version(packageJson.version)
  .parse();

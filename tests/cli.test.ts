import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

test('the compiled CLI displays help', () => {
  const entry = fileURLToPath(new URL('../dist/index.js', import.meta.url));

  const output = execFileSync(process.execPath, [entry, '--help'], {
    encoding: 'utf8',
    timeout: 5_000,
  });

  expect(output).toContain('Usage: callitto');
  expect(output).toContain('--version');
});

import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { expect, test } from 'vitest';

const entry = fileURLToPath(new URL('../dist/index.js', import.meta.url));

function runCli(args: string[], apiKey?: string) {
  const env = { ...process.env };
  delete env.CALLITTO_API_KEY;
  if (apiKey !== undefined) env.CALLITTO_API_KEY = apiKey;

  const result = spawnSync(process.execPath, [entry, ...args], {
    env,
    encoding: 'utf8',
    timeout: 5_000,
  });

  expect(result.error).toBeUndefined();
  expect(result.signal).toBeNull();
  if (apiKey?.trim()) {
    expect(result.stdout + result.stderr).not.toContain(apiKey.trim());
  }
  return result;
}

test.each(['--help', '--version'])('%s works without an API key', (flag) => {
  const result = runCli([flag]);
  expect(result.status).toBe(0);
  expect(result.stderr).toBe('');
  if (flag === '--help') {
    expect(result.stdout).toContain('Usage: callitto');
    expect(result.stdout).toContain('<prompt>');
  } else {
    expect(result.stdout).toMatch(/^\d+\.\d+\.\d+\n$/);
  }
});

test.each(['yoo claude, refactor ini...', 'refactor ini\ntanpa mengubah API'])(
  'accepts a prompt without printing it: %s',
  (prompt) => {
    const result = runCli([prompt], '  test-secret-key  ');
    expect(result.status).toBe(0);
    expect(result.stdout).toBe('Ready.\n');
    expect(result.stderr).toBe('');
  },
);

test.each([
  { args: [], message: "missing required argument 'prompt'" },
  { args: [''], message: 'Prompt must not be empty.' },
  { args: [' \n\t '], message: 'Prompt must not be empty.' },
  { args: ['first', 'second'], message: 'too many arguments' },
])('rejects invalid arguments: $args', ({ args, message }) => {
  const result = runCli(args, 'test-secret-key');
  expect(result.status).toBe(1);
  expect(result.stdout).toBe('');
  expect(result.stderr).toContain(message);
  expect(result.stderr).not.toContain('at file:');
});

test.each([undefined, '', ' \n\t '])(
  'rejects missing or blank API key: %s',
  (key) => {
    const result = runCli(['refactor ini'], key);
    expect(result.status).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toBe(
      'Error: Set CALLITTO_API_KEY before running Callitto.\n',
    );
  },
);

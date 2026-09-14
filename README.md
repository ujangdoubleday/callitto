# Callitto

A second life for your words.

## Requirements

- Node.js 22.x (at least 22.22.2), 24.x, or 26+
- pnpm 12.4.1
- GNU Make (optional; the targets run ordinary pnpm commands)

The Makefile invokes `npx --yes pnpm@12.4.1` so global commands also use the
project's pnpm version, even when an older pnpm is installed on your system.
This requires npm/npx and may download pnpm on the first invocation.

## Development

```sh
make install
make build
make check
node dist/index.js --help
```

Run `make` to list available targets. Husky runs Prettier and ESLint on staged
files before commits. Dependencies are pinned to exact versions in the manifest
and resolved in `pnpm-lock.yaml`.

## Install globally from this checkout

```sh
make install-global
callitto --help
callitto --version
```

This builds the CLI and registers it globally using `pnpm add -g .`. If pnpm's
global bin directory is not configured, run `npx --yes pnpm@12.4.1 setup`, reopen your terminal,
then retry. No npm registry publication is required.

After source changes, run `make install-global` again to rebuild and refresh the
global installation. To remove it:

```sh
make uninstall-global
```

## Usage

```sh
CALLITTO_API_KEY=test-key callitto "yoo claude, refactor ini..."
```

Callitto currently validates the prompt and environment variable, then prints
`Ready.`. It does not contact Gemini or verify the key with the service yet.
API keys are read from `CALLITTO_API_KEY` and are never printed or saved to a file.

## Tooling compatibility

Builds and type checks use TypeScript 7. ESLint uses the official TypeScript 6
compatibility API through a package alias, following the
[TypeScript migration guide](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0).

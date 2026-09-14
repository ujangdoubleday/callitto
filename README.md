# Callitto

A second life for your words.

## Requirements

- Node.js 22.x (at least 22.22.2), 24.x, or 26+
- npm/npx
- GNU Make

Make targets use pnpm 12.4.1 through npx.

## Install

```sh
make install-global
callitto --help
```

If the global bin directory is missing from `PATH`, run:

```sh
npx --yes pnpm@12.4.1 setup
```

Reopen your terminal and retry `make install-global`.

## Usage

```sh
CALLITTO_API_KEY=test-key callitto "yoo claude, refactor ini..."
```

Currently validates the prompt and API key configuration, then prints `Ready.`.
No Gemini request is made yet. The key is never printed or saved by Callitto.

## Development

```sh
make install
make build
make check
node dist/index.js --help
```

Pre-commit hooks run Prettier and ESLint on staged files. Builds use TypeScript 7;
ESLint uses the TypeScript 6 compatibility API.

Run `make install-global` after source changes to refresh the global CLI.

## Uninstall

```sh
make uninstall-global
```

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
pnpm start --help
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

## Tooling compatibility

All direct dependencies use the latest stable releases selected during setup.
TypeScript 7 is newer than the supported peer range declared by typescript-eslint
8.70.0 (`>=4.8.4 <6.1.0`). Installation allows this mismatch and keeps the warning
visible. The current typescript-eslint release explicitly rejects TypeScript 7,
so `pnpm lint`, `make check`, and pre-commit hooks containing staged code fail.
All direct dependencies remain on the latest stable releases as requested; this
is an unresolved upstream compatibility issue, not a passing lint configuration.

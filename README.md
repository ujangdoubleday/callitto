# Callitto

A second life for your words.

## Requirements

- Node.js 22.x (at least 22.22.2), 24.x, or 26+
- npm/npx
- GNU Make

Dependencies and builds use pnpm 12.4.1 through npx. Global installation uses
`npm link`.

## Install

```sh
make install-global
callitto --help
```

This links the checkout into npm's global bin directory, which must be on `PATH`.
Keep the checkout in place while using the global command.

## Usage

```sh
CALLITTO_API_KEY=test-key callitto "yoo claude, refactor ini..."
```

Set `CALLITTO_API_KEY` to your Gemini API key before running the command.
Callitto sends your prompt to Gemini and prints the enhanced English prompt.
The key is never printed or saved by Callitto.

The default model is `gemini-3.8-flash`. Set `CALLITTO_MODEL` to use another model
available to your API key. Requests time out after 60 seconds without automatic
retries. Errors go to stderr; successful output contains only the enhanced prompt.

## Development

```sh
make install
make build
make check
node dist/index.js --help
```

Pre-commit hooks run Prettier and ESLint on staged files. Builds use TypeScript 7;
ESLint uses the TypeScript 6 compatibility API.

Run `make build` after source changes to update the linked CLI.

## Uninstall

```sh
make uninstall-global
```

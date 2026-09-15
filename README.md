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

The spinner goes to stderr, so stdout stays pipeable:

```sh
callitto "refactor ini" > prompt.md
```

The default model is `gemini-3.8-flash`. Set `CALLITTO_MODEL` to use another model
available to your API key. If it fails, Callitto tries `gemini-2.5-flash`, then
`gemini-2.5-flash-lite`. Override the backup order with a comma-separated list:

```sh
CALLITTO_MODEL=gemini-3.8-flash \
CALLITTO_FALLBACK_MODELS=gemini-2.5-flash,gemini-2.5-flash-lite \
callitto "refactor ini"
```

Set `CALLITTO_FALLBACK_MODELS=''` to disable backups. Blank entries are ignored;
duplicate models are attempted only once, with the primary model always first.
Every attempt receives the same prompt and instructions.

Callitto switches models on unavailable models (404), timeouts (408), rate limits
(429), server errors (5xx), network/request failures, and empty or incomplete
responses. It stops on other HTTP errors, missing credentials, client setup
failures, or explicit content blocks. Partial responses are never printed.

Each model gets one attempt with a 60-second timeout. HTTP 408/429/5xx failures
wait 1 second before switching, then 2 seconds for subsequent switches. With the
default three models, requests can take roughly 183 seconds in total; custom
lists can take longer. Fallback cannot resolve shared quota or service outages.

Fallback notices and final errors go to stderr, including the attempted models
and sanitized failure reasons. API keys, raw provider errors, and prompts are
excluded from these diagnostics. Stdout contains only the successful enhanced
prompt; final failures exit with code 1 and no stdout.

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

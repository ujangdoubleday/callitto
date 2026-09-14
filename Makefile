.DEFAULT_GOAL := help
PNPM := npx --yes pnpm@12.4.1

.PHONY: help install build check install-global uninstall-global

help:
	@printf '%s\n' \
		'make install          Install dependencies' \
		'make build            Compile CLI' \
		'make check            Run all checks' \
		'make install-global   Build and register callitto globally' \
		'make uninstall-global Remove global callitto'

install:
	$(PNPM) install --frozen-lockfile

build:
	$(PNPM) build

check:
	$(PNPM) lint
	$(PNPM) typecheck
	$(PNPM) format:check
	$(PNPM) test

install-global:
	$(MAKE) install
	$(MAKE) build
	$(PNPM) add -g .

uninstall-global:
	$(PNPM) remove -g callitto

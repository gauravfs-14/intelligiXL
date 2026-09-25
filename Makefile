# IntelligiXL — common tasks. Run `make` (or `make help`) to list targets.
# Targets are thin wrappers around pnpm scripts, scripts/*.sh and docker compose.

.DEFAULT_GOAL := help
SHELL := /bin/bash

COMPOSE ?= docker compose

.PHONY: help setup dev web worker infra-up infra-down db-migrate db-deploy db-seed \
        db-studio lint typecheck build start docker-up docker-down docker-logs laya clean

help: ## Show this help
	@awk 'BEGIN {FS = ":.*## "; printf "Usage: make <target>\n\nTargets:\n"} \
	  /^[a-zA-Z0-9_-]+:.*## / {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

setup: ## One-time local setup: deps, .env, postgres+redis, migrations, seed (safe to re-run)
	@scripts/setup.sh

dev: ## Run web (next dev, PORT=3000) + worker (watch) together; Ctrl-C stops both
	@scripts/dev.sh

web: ## Run only the Next.js dev server
	pnpm dev

worker: ## Run only the job worker (watch mode)
	pnpm worker

infra-up: ## Start postgres + redis containers and wait until healthy
	$(COMPOSE) up -d --wait postgres redis

infra-down: ## Stop all containers (data volumes are kept)
	$(COMPOSE) --profile app --profile laya down

db-migrate: ## Create/apply a migration in development (prisma migrate dev)
	pnpm db:migrate

db-deploy: ## Apply pending migrations (prisma migrate deploy)
	pnpm db:deploy

db-seed: ## Seed the database (idempotent)
	pnpm db:seed

db-studio: ## Open Prisma Studio
	pnpm db:studio

lint: ## Run ESLint
	pnpm lint

typecheck: ## Type-check with tsc --noEmit
	pnpm typecheck

build: ## Production build (next build)
	pnpm build

start: ## Production on the host: build, migrate, then next start + worker together
	@scripts/start.sh

docker-up: ## Build and run the full stack in Docker (postgres, redis, app, worker) on APP_PORT=3000
	$(COMPOSE) --profile app up -d --build --wait

docker-down: ## Stop the Docker stack (volumes are kept)
	$(COMPOSE) --profile app --profile laya down

docker-logs: ## Follow logs of the app and worker containers
	$(COMPOSE) --profile app logs -f app worker

laya: ## Build and run the self-hosted Laya engine container (LAYA_PORT=8000)
	$(COMPOSE) --profile laya up -d --build --wait laya

clean: ## Remove the .next build directory
	rm -rf .next

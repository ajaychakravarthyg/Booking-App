# Convenience wrapper. Everything here is a plain docker/mvn/npm command — nothing
# depends on make, it just saves typing.
#
#   make help        list targets
#   make up          build and start the whole stack
#   make smoke       exercise the API end to end against a running stack
#   make race        prove concurrent double-bookings are rejected

SHELL := /bin/bash
GATEWAY ?= http://localhost:8080
SERVICES := discovery-server api-gateway auth-service room-service booking-service

.DEFAULT_GOAL := help
.PHONY: help up down reset logs ps build test frontend-dev frontend-build smoke race clean

help: ## List available targets
	@grep -hE '^[a-zA-Z_-]+:.*?## ' $(MAKEFILE_LIST) \
		| awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-16s\033[0m %s\n", $$1, $$2}'

up: ## Build and start the full stack (Postgres + Eureka + 4 services + frontend)
	docker compose up --build -d
	@echo
	@echo "Waiting for the gateway to report healthy (services start in sequence)…"
	@for i in $$(seq 1 90); do \
		if curl -sf $(GATEWAY)/actuator/health >/dev/null 2>&1; then \
			echo "  ready after $${i}s"; break; \
		fi; sleep 2; \
	done
	@echo
	@echo "  app       http://localhost:3000"
	@echo "  swagger   $(GATEWAY)/swagger-ui.html"
	@echo "  eureka    http://localhost:8761"
	@echo "  login     admin@hotel.com / Admin@12345"

down: ## Stop everything, keep the database
	docker compose down

reset: ## Stop everything and WIPE the database
	docker compose down -v

ps: ## Health of every container
	docker compose ps

logs: ## Follow all logs (make logs S=booking-service for one)
	docker compose logs -f $(S)

build: ## Compile every Java service without Docker
	@for s in $(SERVICES); do echo "── $$s"; (cd $$s && mvn -B -q clean package -DskipTests) || exit 1; done
	@echo "all services packaged"

test: ## Run every Java service's tests
	@for s in $(SERVICES); do echo "── $$s"; (cd $$s && mvn -B test) || exit 1; done

frontend-dev: ## Vite dev server on :5173, proxying /api to the gateway
	cd frontend && npm install && npm run dev

frontend-build: ## Production frontend build
	cd frontend && npm ci && npm run build

smoke: ## Exercise register → search → book → double-book → cancel
	@bash scripts/smoke-test.sh $(GATEWAY)

race: ## Fire N concurrent identical bookings; exactly one must succeed
	@bash scripts/race-test.sh $(GATEWAY)

clean: ## Remove build output
	@for s in $(SERVICES); do (cd $$s && mvn -B -q clean) || true; done
	rm -rf frontend/dist frontend/node_modules/.vite
	@echo "cleaned"

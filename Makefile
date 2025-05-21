all: build

build:
	npm run build

deploy:
	npm run deploy

dev:
	npm run dev

log:
	wrangler tail

.PHONY: help dev build all log

list-users:
	wrangler d1 execute auth0_events --remote --command "SELECT * FROM users" --json

help:
	@echo "Available targets:"
	@echo "  all (default) - Build the project"
	@echo "  build         - Build the project using webpack"
	@echo "  deploy        - Deploy the worker to Cloudflare"
	@echo "  dev           - Run the worker locally for development"
	@echo "  help          - Show this help message"
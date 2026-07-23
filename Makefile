.PHONY: build dev test lint clean up down observability

build:
	docker compose build

dev:
	docker compose up

up:
	docker compose up -d

down:
	docker compose down

test:
	docker compose run --rm api python -m pytest app/tests -v || pytest app/tests -v

lint:
	docker compose run --rm api python -m ruff check app || ruff check app

observability:
	docker compose up prometheus grafana loki jaeger

clean:
	docker compose down -v
	rm -rf __pycache__ .pytest_cache .ruff_cache

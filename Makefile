.PHONY: help start stop restart logs clean rebuild shell-backend shell-frontend status

help:
	@echo "Red Pandas Development Commands"
	@echo "==============================="
	@echo "make start      - Start development environment"
	@echo "make stop       - Stop all containers"
	@echo "make restart    - Restart all containers"
	@echo "make logs       - View all logs"
	@echo "make clean      - Clean up everything"
	@echo "make rebuild    - Rebuild from scratch"
	@echo "make status     - Show container status"

start:
	@./dev.sh start

stop:
	@./dev.sh stop

restart:
	@./dev.sh restart

logs:
	@./dev.sh logs

clean:
	@./dev.sh clean

rebuild:
	@./dev.sh rebuild

shell-backend:
	@./dev.sh shell backend

shell-frontend:
	@./dev.sh shell frontend

status:
	@./dev.sh status
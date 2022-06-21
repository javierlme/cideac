#!make
# Env variables
include .env

APP_NAME=fps
SERVICE_NAME=backend
VERSION?=dev
PROJECT_NAME=${APP_NAME}-${VERSION}
IMAGE_NAME?=${PROJECT_NAME}_${SERVICE_NAME}
CACHE_IMAGE?=${IMAGE_NAME}
NO_WARNINGS=--log-level 'ERROR'
n=100

export

# Targets
.PHONY: install start show logs restart stop remove uninstall

# Install (build ALL services)
install:
# 	docker-compose -p ${PROJECT_NAME} build --compress
	docker build -t ${IMAGE_NAME} --cache-from ${CACHE_IMAGE} --compress .

push:
	docker push ${IMAGE_NAME}

pull:
	docker-compose pull

# Start services
start:
	docker-compose -p ${PROJECT_NAME} up -d

# Show ALL the project's containers
show:
	docker-compose -p ${PROJECT_NAME}  ${NO_WARNINGS} ps

# Show the project's logs
logs:
	docker-compose -p ${PROJECT_NAME} ${NO_WARNINGS} logs -tf

tail:
	docker-compose -p ${PROJECT_NAME} logs -tf --tail=${n}

# Open a bash terminal inside the container
enter:
	docker-compose -p ${PROJECT_NAME} exec ${SERVICE_NAME} bash

# Restart services
restart:
	docker-compose -p ${PROJECT_NAME} restart

# Stop services
stop:
	- docker-compose -p ${PROJECT_NAME} stop

# Stop services and remove containers
remove:
	- docker-compose -p ${PROJECT_NAME} rm -sf

# Stop ALL services and remove docker images
uninstall: remove
	- docker rmi -f ${IMAGE_NAME}
	- docker-compose -p ${PROJECT_NAME} down

# Show configuration of a given service
config:
	docker-compose -p ${PROJECT_NAME} config

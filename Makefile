build-docker-backend:
	docker build -f apps/backend-node/Dockerfile -t tsw-backend-node .

run-docker-backend:
	docker run --env-file ./apps/backend-node/.env -p 3000:3000 tsw-backend-node
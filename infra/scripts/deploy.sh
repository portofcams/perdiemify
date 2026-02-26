#!/bin/bash
# deploy.sh — Quick deploy from local machine
set -e

echo "=== Deploying Perdiemify ==="

ssh -i ~/.ssh/perdiemify deploy@45.77.120.186 << 'ENDSSH'
cd /opt/perdiemify
git pull origin main
docker compose -f infra/docker-compose.prod.yml build
docker compose -f infra/docker-compose.prod.yml up -d
docker system prune -f
echo "Deploy complete!"
ENDSSH

#!/bin/bash

echo "--- Begin infra deploy process ---"
echo "Running command 'git pull'"
git pull

while true; do
    read -p "Do you wish to install this program? if yes, You have already changed plain secrets in: '/docker/redis/redis.conf' and in 'docker-compose.yml' " yn
    case $yn in
        [Yy]* ) npm run build; break;;
        [Nn]* ) exit;;
        * ) echo "Please answer yes or no.";;
    esac
done

find ./docker -type f -print0 | xargs -0 dos2unix

echo "Running command 'docker compose up'"
docker compose up -d
echo "--- Deploy infra complete ---"

echo "Redis & MongoDB should be running. Now go and lunch the Node JS app"

# to update docker images: docker pull amir20/dozzle:latest
# docker compose build --no-cache redis-service
# ansible-core
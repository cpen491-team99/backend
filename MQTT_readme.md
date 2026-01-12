# README 

## Start Up
- Start docker: `docker compose -f infra/mqtt-broker/docker-compose.yml up -d`
- Rebuild ts for server.js: `npm run build`
- Start Backend: `npm run start`
- Start dev frontend: `node dist/tools/mqtt-dev-client/index.js`

## End 
- End docker: `docker compose -f infra/mqtt-broker/docker-compose.yml down`
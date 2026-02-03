# README 

## Dependencies
- `npm i mqtt`
- `npm i -D typescript ts-node @types/node`

## Start Up
- Start docker: `docker compose -f infra/mqtt-broker/docker-compose.yml up -d`
- Rebuild ts for server.js: `npm run build`
- Start Backend: `npm run start`
- Start dev frontend: `node dist/tools/mqtt-dev-client/index.js alice agentA`

## End 
- End docker: `docker compose -f infra/mqtt-broker/docker-compose.yml down`

## Run the Database test version backend client
- Make sure `server.js` is in the root folder, and other files in their original folder. (directly move everything in the root folder of mqtt branch to database branch root folder, then the location import should work)
- Start docker: `docker compose -f infra/mqtt-broker/docker-compose.yml up -d`
- Rebuild ts for server.js: `npm run build`
- Start Backend: `node server_test.js`
- Start dev frontend: `node dist/tools/mqtt-dev-client/index.js alice agentA`


## Frontend Client commends:
- `join` + room name: join the room
- `say` + any input: send message
- `leave`: leave current room
- `exit`: end client, same as ctrl + c
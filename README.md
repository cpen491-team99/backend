# README 

## Dependencies
- `npm install`

## Start Up
- Start docker: `npm run dockerup`
- Rebuild ts for server.js: `npm run build`
- Start Backend: `npm run start`
- Start dev frontend: `node dist/tools/mqtt-dev-client/index.js alice agentA`

## End 
- End docker: `npm run dockerdown`

## Frontend Client commends:
- `join` + room name: join the room
- `say` + any input: send message
- `leave`: leave current room
- `exit`: end client, same as ctrl + c
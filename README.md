# README 

## Set Up Dependencies
Make sure you are in the project directory before you running any command

### Node
#### Ubuntu Enviroment 
- Install nvm by following instruction on [NVM GitHub Page](https://github.com/nvm-sh/nvm). 
- After get nvm, install latest Node by running `nvm install node`.
- `nvm use [version_number]` to start the node you just install
- Install node dependencies by running `npm install ws`. `npm install mongodb`, `npm install express`, and `npm install axios`
- (Not requirement) Install nodemon by `npm install nodemon`

#### Powershell Enviroment 
Windows user could use powershell directly, to avoid localhost address change
- Install Node on [Node Website](https://nodejs.org/en). 
- Install node dependencies by running `npm install ws`. `npm install mongodb`, `npm install express`, and `npm install axios`
    - If install failed, you need run powershell as administrator, and run `Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser` to allow `npm` install. Now, you can run the install command.
        - If you want to redo this command, you can run `Set-ExecutionPolicy -ExecutionPolicy Restricted -Scope CurrentUser`
- (Not requirement) Install nodemon by `npm install nodemon`


### Run the server

#### Ubuntu
- Go to the virtual memory of python
- Open ollama
- Start AI model `python ai_backend.py`
- Run the Node to start server by `node server.js` or `npx nodemon server.js`
- If want to reset the chat room and message data, run `mongosh` to start mongo shell, and load .mongo file by `load("initdb.mongo")` and `load("initUsers.mongo")` to initial user data.

#### Powershell
- Open Ollama 
- Start AI model `python ai_backend.py`
- Run the Node to start server by `node server.js` or `npx nodemon server.js`
- If want to reset the chat room and message data, run `mongosh` to start mongo shell, and load .mongo file by `load("initdb.mongo")` and `load("initUsers.mongo")` to initial user data.

// const path = require('path');
// const fs = require('fs');
// const express = require('express');
// const Database = require('./Database.js');
// const SessionManager = require('./SessionManager.js');
// const crypto = require('crypto');
// const axios = require('axios');

// //Require ws library 
// const WebSocket = require('ws');

// //Mongodb database
// const mongoUrl = 'mongodb://localhost:27017';
// const dbName = 'cpen322-messenger';
// const db = new Database(mongoUrl, dbName);

// const { Timestamp } = require('mongodb');

// function logRequest(req, res, next){
// 	console.log(`${new Date()}  ${req.ip} : ${req.method} ${req.path}`);
// 	next();
// }

// const host = 'localhost';
// const port = 3000;
// const clientApp = path.join(__dirname, 'client');

// // express app
// let app = express();

// app.use(express.json()) 						// to parse application/json
// app.use(express.urlencoded({ extended: true })) // to parse application/x-www-form-urlencoded
// app.use(logRequest);							// logging for debug

// const sessionManager = new SessionManager();

// //Connect AI FAQ endpoint
// app.route('/api/ai/faq')
//     .post(async (req, res) => {
//         try {
//             const question = req.body.question;
//             const roomId = req.body.roomId; 

//             //Send question to the AI endpoint
//             const aiResponse = await axios.post('http://localhost:5000/api/faq', { question });

//             //Get the response back to the client
//             const aiMessage = aiResponse.data.answer;

//             //Send the answer back
//             res.json({ answer: aiMessage });
//         } catch (error) {
//             console.error('Error connecting to AI backend:', error);
//             res.status(500).json({ error: 'Error connecting to AI backend' });
//         }
//     });

// //Connect AI summarization endpoint
// app.route('/api/ai/summarize')
//     .post(async (req, res) => {
//     try {
//         const conversation = req.body.conversation;
//         const aiResponse = await axios.post('http://localhost:5000/api/summarize', { conversation });
//         res.json({ summary: aiResponse.data.summary });
//     } catch (error) {
//         console.error('Error connecting to AI backend:', error);
//         res.status(500).json({ error: 'Error connecting to AI backend' });
//     }
// });

// //Connect AI insights endpoint
// app.route('/api/ai/insights')
//     .post(async (req, res) => {
//         try {
//             const summary = req.body.summary;
//             const aiResponse = await axios.post('http://localhost:5000/api/insights', { summary });
//             res.json({ insights: aiResponse.data.insights });
//         } catch (error) {
//             console.error('Error connecting to AI backend:', error);
//             res.status(500).json({ error: 'Error connecting to AI backend' });
//         }
//     });

// // Serve static files without middleware for public access
// app.get('/login.html', express.static(clientApp));
// app.get('/style.css', express.static(clientApp));
// app.get('/ChatAI.html', express.static(clientApp));
// app.get('/index.html', sessionManager.middleware);
// app.get('/app.js', sessionManager.middleware);

// app.get('/chat', sessionManager.middleware);
// app.post('/chat', sessionManager.middleware);
// app.get('/chat/:room_id', sessionManager.middleware);
// app.get('/chat/:room_id/messages', sessionManager.middleware);
// app.get('/index', sessionManager.middleware);


// //Endpoint for profile
// app.route('/profile')
//     .get(sessionManager.middleware, function(req, res, next) {
//         // console.log(`[Debug] username: ${req.username}`);
//         res.json({ username: req.username });
//     })

// // app.get('/', sessionManager.middleware);
// app.route('/logout')
//     .get(sessionManager.middleware, function(req, res, next) {
//         sessionManager.deleteSession(req);
//         res.redirect('/login');
//     })



// app.get('/', sessionManager.middleware);
// app.use('/', express.static(clientApp, { extensions: ['html'] }));

// var messages  = {

// };

// const messageBlockSize = 2; 

// //Initialize messages
// db.getRooms()
//     .then(rooms =>{
//         rooms.forEach(room => {
//             //initialization
//             messages[room._id] = [];
//         });
//     })
//     .catch(err => {
//         //Posible error handler
//     })


// // Helper function for escaping HTML to prevent XSS attacks
// function escapeHtml(text) {
//     return text.replace(/[&<>'"/]/g, (char) => {
//         switch (char) {
//             case '&':
//                 return '&amp;';
//             case '<':
//                 return '&lt;';
//             case '>':
//                 return '&gt;';
//             default:
//                 return char;
//         }
//     });
// }

// //Request Handler
// app.route('/chat')
//     .get(function (req, res, next) {
//         db.getRooms()
//             .then(rooms => {
//                 //Map room property for each room
//                 const response = rooms.map(room => ({
//                     _id: room._id,
//                     name: room.name,
//                     image: room.image,
//                     //Get messages if available
//                     messages: messages[room._id] || []  
//                 }));
//                 res.json(response);
//             })
//             .catch(err => {
//                 //Possible error handler
//                 console.error('[Server] Failed to get rooms:', error);
//             })
//     })
//     .post(function (req, res, next) {
//         //Set to JSON string
//         var data = req.body;

//         //Use db function to build room
//         db.addRoom(data)
//             .then(newRoom => {
//                 //Initialize room
//                 messages[newRoom._id] = [];
//                 res.status(200).json(newRoom);
//             })
//             .catch(err => {
//                 if (err.message === "No Room Name") {
//                     //Handle no roon name
//                     res.status(400).json({ message: err.message });
//                 } else {
//                     //Other possible error handler
//                 }
//             })
//     });


// //Endpoint at /chat/:room_id
// app.route('/chat/:room_id')
//     .get(function (req, res, next){
//         var roomId = req.params.room_id;

//         //get room from db
//         db.getRoom(roomId)
//             .then(room => {
//                 if (room) {
//                     //Return room if valid
//                     res.json(room);
//                 } else {
//                     //Reject with 404 error message
//                     res.status(404).json({error: `Room ${roomId} was not found`});
//                 }
//             })
//             .catch(err => {
//                 //possible error handler
//                 console.error('[Server] Failed to get room:', error);
//             });
//     });

// //Endpoint at messages
// app.route('/chat/:room_id/messages')
//     .get(function (req, res, next){
//         //Get room_id from address
//         var roomId = req.params.room_id;
//         //Get timestamp from query
//         var timestamp = parseInt(req.query.before);

//         db.getLastConversation(roomId, timestamp)
//             .then(conversation => {
//                 if (conversation) {
//                     res.json(conversation);
//                 } else {
//                     //Error handler
//                 }
//             })
//             .catch(err => {
//                 //Error handler
//             })

//     });


// const broker = new WebSocket.Server({ port: 8000 })

// //Connection Event Handler
// broker.on('connection', (clientSocket, request) => {
//     //Protect connection endpoint by cookie
//     try {
//         //Extract cookies from the request headers
//         const cookieHeader = request.headers.cookie;
//         if (!cookieHeader) {
//             //console.log('[WebSocket] No cookie found, closing connection');
//             clientSocket.close();
//             return;
//         }

//         //Parse cookies to extract 'cpen322-session'
//         const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
//             const [key, value] = cookie.split('=').map(c => c.trim());
//             acc[key] = value;
//             return acc;
//         }, {});

//         //Get encode token
//         const encodedToken = cookies['cpen322-session'];
//         if (!encodedToken) {
//             //console.log('[WebSocket] Missing session token, closing connection');
//             clientSocket.close();
//             return;
//         }

//         const token = decodeURIComponent(encodedToken);

//         //Check if the token exists in the session manager
//         const Username = sessionManager.getUsername(token);
//         //console.log(`decode token ${token}, encode token ${encodedToken}, ${sessionData}`);
//         if (!Username) {
//             //console.log('[WebSocket] Invalid session token, closing connection');
//             clientSocket.close();
//             return;
//         }

//         //Attach session-based username to the socket
//         clientSocket.username = Username;
//         //console.log(`[WebSocket] Connection established for user: ${clientSocket.username}`);

//         //Handle incoming messages
//         clientSocket.on('message', (message) => {
//             try {
//                 //Parse message
//                 const messageData = JSON.parse(message);
//                 const { roomId, text } = messageData;

//                 // Sanitize message content to prevent XSS
//                 var sanitizedText = escapeHtml(text);
//                 sanitizedText = sanitizedText.replace(/\n/g, '<br>').replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

//                 let username;

//                 //Overwrite username by current login user
//                 if (messageData.username === "AI Assistant") {
//                     username = messageData.username;
//                 } else {
//                     username = clientSocket.username;
//                 }
//                 // const username = clientSocket.username;
//                 // let username = messageData.username || clientSocket.username;

//                 //Store message in the appropriate room
//                 if (messages[roomId]) {
//                     messages[roomId].push({ username, text: sanitizedText });
//                 }

//                 //Save to the database if the message block size is reached
//                 if (messages[roomId].length >= messageBlockSize) {
//                     const conversation = {
//                         room_id: roomId,
//                         timestamp: Date.now(),
//                         messages: messages[roomId],
//                     };

//                     db.addConversation(conversation)
//                         .then(() => (messages[roomId] = []))
//                         .catch(err => console.error('[WebSocket] Failed to save conversation:', err));
//                 }

//                 //Forward the message to all other connected clients
//                 broker.clients.forEach(client => {
//                     if (client !== clientSocket && client.readyState === WebSocket.OPEN) {
//                         client.send(JSON.stringify({ roomId, username, text: sanitizedText }));
//                     }
//                 });
//             } catch (err) {
//                 console.error('[WebSocket] Error processing message:', err);
//             }
//         });
//     } catch (err) {
//         console.error('[WebSocket] Error processing connection:', err);
//         clientSocket.close();
//     }
// });


// //Password correction helper function
// function isCorrectPassword(password, saltedHash) {
//     const salt = saltedHash.slice(0, 20);  // Extract salt
//     const correct_password = saltedHash.slice(20);     // Extract hash

//     //Compute SHA256 hash of password + salt
//     const salted_password = crypto.createHash('sha256').update(password + salt).digest('base64');

//     return salted_password === correct_password;
// }

// //Endpoint at Login
// app.route('/login')
//     .post(function(req, res, next){
//         var {username, password} = req.body;
//         // console.log('This is the post function');
//         db.getUser(username)
//             .then(user => {
//                 if (!user) {
//                     //if user does not exist
//                     // console.log(`No user`);
//                     res.redirect('/login');
//                 } else if (isCorrectPassword(password, user.password)) {
//                     //Successful login
//                     sessionManager.createSession(res, username);
//                     // console.log(`here is the username ${username}`);
//                     res.redirect('/');
//                 } else {
//                     //Wrong password
//                     // console.log(`Error password`);
//                     res.redirect('/login');
//                 }
//             })
//             .catch(err => {
//                 //Error handler
//             });
//     });

// //Error handler for middleware
// app.use((err, req, res, next) => {
//     if (err instanceof SessionManager.Error) {
//         if (req.headers.accept && req.headers.accept.includes('application/json')) {
//             res.status(401).json({ error: err.message });
//         } else {
//             res.redirect('/login');
//         }
//     } else {
//         res.status(500).json({ error: 'Not a SessionError' });
//     }
// });

// app.listen(port, () => {
//     console.log(`${new Date()}  App Started. Listening on ${host}:${port}, serving ${clientApp}`);
// });

const express = require("express");

const app = express();
const host = "localhost";
const port = 3000;

app.get("/", (req, res) => {
  res.send("Server is running.");
});

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(port, host, () => {
  console.log(`Listening on http://${host}:${port}`);
});

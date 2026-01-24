import neo4j from 'neo4j-driver';
import { runAdminQuery } from './db_driver.js';


/**
 * Lists all chatrooms ordered by creation time and name.
 *
 * @returns array of Chatroom Objects
 */
export async function listChatrooms() {
  const cypher = `
    MATCH (c:Chatroom)
    RETURN c
    ORDER BY c.createdAt DESC, c.name ASC
  `;
  const result = await runAdminQuery(cypher);
  return result.records.map(r => r.get('c').properties);
}

/**
 * Lists all users with username, email and preferences.
 *
 * @returns array of User objects.
 */
export async function listUsers() {
  const cypher = `
    MATCH (u:User)
    RETURN
      u.username AS username,
      u.email AS email,
      u.preferences AS preferences
    ORDER BY u.username ASC
  `;
  const result = await runAdminQuery(cypher);
  return result.records.map(r => ({
    username: r.get('username'),
    email: r.get('email'),
    preferences: r.get('preferences') ?? null,
  }));
}

/**
 * Lists messages sent by a specific User or Agent, optionally before a given time.
 *
 * @param senderId - ID of the sender node (User or Agent).
 * @param senderIsUser - Whether the sender is a User (true) or Agent (false). Default to True.
 * @param before - OPTIONAL: ISO datetime string; only messages with sentAt before this are returned.
 * @param limit - OPTIONAL Maximum number of messages to return.
 * @returns array of message objects.
 */
export async function listMessagesBySender({
  senderId,
  senderIsUser = true,
  before = null,   // ISO string, e.g. new Date().toISOString()
  limit = 10,
}) {
  const senderLabel = senderIsUser ? 'User' : 'Agent';

  const cypher = `
    MATCH (s:${senderLabel} { id: $senderId })-[:SENT]->(m:Message)
    WHERE $before IS NULL OR m.sentAt < datetime($before)
    RETURN m
    ORDER BY m.sentAt DESC
    LIMIT $limit
  `;

  const params = { 
    senderId, 
    before, 
    limit : neo4j.int(limit), 
  };
  
  const result = await runAdminQuery(cypher, params);
  return result.records.map(r => r.get('m').properties);
}

/**
 * Lists messages sent in a Chatroom, optionally before a given time.
 *
 * @param chatroomId - ID of Chatroom. 
 * @param before - OPTIONAL: ISO datetime string; only messages with sentAt before this are returned.
 * @param limit - OPTIONAL Maximum number of messages to return.
 * @returns array of message objects.
 */
export async function listMessagesByChatroom({
  chatroomId,
  before = null,   // ISO string, e.g. new Date().toISOString()
  limit = 10,
}) {

  const cypher = `
    MATCH (s:Chatroom { id: $chatroomId })-[:HEARS]->(m:Message)
    WHERE $before IS NULL OR m.sentAt < datetime($before)
    RETURN m
    ORDER BY m.sentAt DESC
    LIMIT $limit
  `;
  const params = { 
    chatroomId, 
    before, 
    limit : neo4j.int(limit), 
  };

  const result = await runAdminQuery(cypher, params);
  return result.records.map(r => r.get('m').properties);
}


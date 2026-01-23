import neo4j from 'neo4j-driver';
import { runAdminQuery } from './db_driver.js';


// List all chatrooms
export async function listChatrooms() {
  const cypher = `
    MATCH (c:Chatroom)
    RETURN c
    ORDER BY c.createdAt DESC, c.name ASC
  `;
  const result = await runAdminQuery(cypher);
  return result.records.map(r => r.get('c').properties);
}

// List all users (username, email, preferences)
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

// List messages by a sender (User or Agent), before a time, with limit
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

  const params = { senderId, before, limit : neo4j.int(limit), };
  const result = await runAdminQuery(cypher, params);
  return result.records.map(r => r.get('m').properties);
}
// ...existing code...
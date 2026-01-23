import { runAdminQuery } from './db_driver.js';

/**
 * One‑time schema setup: 
 */
export async function initSchema() {

    await runAdminQuery(`
        CREATE CONSTRAINT user_id_unique IF NOT EXISTS
        FOR (u:User)
        REQUIRE u.id IS UNIQUE;
    `);

    await runAdminQuery(`
        CREATE CONSTRAINT chatroom_id_unique IF NOT EXISTS
        FOR (c:Chatroom)
        REQUIRE c.id IS UNIQUE;
    `);

    await runAdminQuery(`
        CREATE CONSTRAINT message_id_unique IF NOT EXISTS
        FOR (m:Message)
        REQUIRE m.id IS UNIQUE;
    `);
}


// Create or update a user
export async function saveUser({ id, username, email, preferences }) {
  const cypher = `
    MERGE (u:User { id: $id })
    ON CREATE SET u.createdAt = datetime()
    SET u.username = $username,
        u.email = $email,
        u.updatedAt = datetime(),
        u.preferences = $preferences
    RETURN u
  `;
  const result = await runAdminQuery(cypher, {
    id,
    username,
    email,
    preferences: preferences ? JSON.stringify(preferences) : null,
  });
  return result.records[0]?.get('u').properties;
}

// Create or update an Agent. 
// Builds a HOSTS relationship between User and Agent.
export async function saveAgent({ id, uid, agentname, persona }) {
  const cypher = `
    MATCH (u:User { id: $uid })
    MERGE (a:Agent { id: $id })
    ON CREATE SET u.createdAt = datetime()
    SET a.agentname = $agentname,
        u.persona = $persona,
        u.updatedAt = datetime()
    MERGE (u)-[:HOSTS]->(a)
    RETURN u
  `;
  const result = await runAdminQuery(cypher, { id, uid, agentname, persona });
  return result.records[0]?.get('u').properties;
}

// Create or update a chatroom
export async function saveChatroom({ id, roomname }) {
  const cypher = `
    MERGE (c:Chatroom { id: $id })
    ON CREATE SET c.createdAt = datetime()
    SET c.name = $roomname,
        c.updatedAt = datetime()
    RETURN c
  `;
  const result = await runAdminQuery(cypher, { id, roomname });
  return result.records[0]?.get('c').properties;
}


// Create a message in a chatroom. 
// Builds the SENT relationship between sender and message. 
export async function saveMessage({ id, text, senderId, chatroomId, sentAt, senderIsUser = true}) {
  const senderLabel = senderIsUser ? 'User' : 'Agent';

  const cypher = `
    MATCH (s:${senderLabel} { id: $senderId })
    MATCH (c:Chatroom { id: $chatroomId })
    CREATE (m:Message {
      id: $id,
      text: $text,
      senderId: $senderId,
      chatroomID: $chatroomId,
      senderIsUser: $senderIsUser,
      sentAt: coalesce($sentAt, datetime())
    })
    MERGE (s)-[:SENT]->(m)
    MERGE (c)-[:HEARS]->(m)
    RETURN m
  `;

  const params = { id, text, senderId, chatroomId, senderIsUser, sentAt: sentAt || null };
  const result = await runAdminQuery(cypher, params);
  return result.records[0]?.get('m').properties;
}
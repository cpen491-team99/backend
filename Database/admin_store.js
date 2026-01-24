import { runAdminQuery } from './db_driver.js';

/**
 * Initializes one-time Neo4j schema constraints for users, chatrooms and messages.
 *
 * @returns Promise that resolves when all constraints have been created.
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

/**
 * Creates or updates a user node with basic profile and preference data.
 *
 * @param id - Unique identifier for the user.
 * @param username - Username associated with the user.
 * @param email - Email address of the user.
 * @param preferences - OPTIONAL JSON-serializable user preference object.
 * @returns The saved user's property object.
 */
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

/**
 * Creates or updates an Agent node and builds a HOSTS relationship from the owning user.
 *
 * @param id - Unique identifier for the agent.
 * @param uid - ID of the User who hosts this agent.
 * @param agentname - Display name for the agent.
 * @param persona - OPTIONAL JSON-serializable persona description for the agent.
 * @returns The updated hosting user's property object.
 */
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
  const result = await runAdminQuery(cypher, { 
    id, 
    uid, 
    agentname, 
    persona : persona ? JSON.stringify(persona) : null });

  return result.records[0]?.get('u').properties;
}

/**
 * Creates or updates a chatroom node with a given name.
 *
 * @param id - Unique identifier for the chatroom.
 * @param roomname - Human-readable name of the chatroom.
 * @returns The saved chatroom's property object.
 */
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

/**
 * Creates a message in a chatroom and links it to the sender and chatroom.
 *
 * @param id - Unique identifier for the message.
 * @param text - Text content of the message.
 * @param senderId - ID of the sending User or Agent.
 * @param chatroomId - ID of the chatroom where the message is posted.
 * @param sentAt - OPTIONAL explicit datetime for when the message was sent.
 * @param senderIsUser - Whether the sender is a User (true) or Agent (false). Defaults to true.
 * @returns The saved message's property object.
 */
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
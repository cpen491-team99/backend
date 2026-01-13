// dbEntities.js
import { runQuery } from './neo4jDriver.js';

/**
 * One‑time schema setup: uniqueness + basic indexes.
 */
export async function initSchema() {
  await runQuery(`
    CREATE CONSTRAINT agent_id IF NOT EXISTS
    FOR (a:Agent) REQUIRE a.a_id IS UNIQUE
  `);

  await runQuery(`
    CREATE CONSTRAINT memory_id IF NOT EXISTS
    FOR (m:Memory) REQUIRE m.m_id IS UNIQUE
  `);
}

/**
 * Create an Agent node.
 * agent = { a_id, name, persona, attributes }
 */
export async function createAgent(agent) {
  const { a_id, name, persona = null } = agent;

  const result = await runQuery(
    `
    CREATE (a:Agent {
      a_id: $a_id,
      name: $name,
      persona: $persona
    })
    RETURN a
    `,
    { 
        a_id, 
        name, 
        persona
    }
  );

  return result.records[0].get('a').properties;
}

/**
 * Create a Memory node and OWNS relationship from its owner.
 * memory = { m_id, owner_id, time_created, description, embedding }
 */
export async function createMemory(memory) {
  const {
    m_id,
    owner_id,
    time_created = new Date().toISOString(),
    description = '',
    embedding = []
  } = memory;

  const result = await runQuery(
    `
    MATCH (owner:Agent { a_id: $owner_id })
    CREATE (m:Memory {
      m_id: $m_id,
      owner_id: $owner_id,
      time_created: datetime($time_created),
      description: $description,
      embedding: $embedding
    })
    MERGE (owner)-[:OWNS]->(m)
    RETURN m, owner
    `,
    { m_id, owner_id, time_created, description, embedding }
  );

  return {
    memory: result.records[0].get('m').properties,
    owner: result.records[0].get('owner').properties
  };
}

/**
 * Explicitly create OWNS between existing Agent and Memory.
 */
export async function createOwnsRelationship(a_id, m_id) {
  await runQuery(
    `
    MATCH (a:Agent { a_id: $a_id })
    MATCH (m:Memory { m_id: $m_id })
    MERGE (a)-[:OWNS]->(m)
    `,
    { a_id, m_id }
  );
}

/**
 * Create PRECEDES relationship between two Memory nodes.
 */
export async function createPrecedesRelationship(from_m_id, to_m_id) {
  await runQuery(
    `
    MATCH (m1:Memory { m_id: $from_m_id })
    MATCH (m2:Memory { m_id: $to_m_id })
    MERGE (m1)-[:PRECEDES]->(m2)
    `,
    { from_m_id, to_m_id }
  );
}
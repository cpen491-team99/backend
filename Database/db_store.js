import { runQuery } from './db_driver.js';

/**
 * One‑time schema setup: 
 * uniqueness + basic indexes + vector index config
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

  await runQuery(`
    CREATE CONSTRAINT location_id IF NOT EXISTS
    FOR (l:Location) REQUIRE l.l_id IS UNIQUE
  `);

  // Vector Index for similarity search
  await runQuery(`
    CREATE VECTOR INDEX memory_embeddings IF NOT EXISTS
    FOR (m:Memory) ON (m.embedding)
    OPTIONS {indexConfig: {
      \`vector.dimensions\`: 1024,
      \`vector.similarity_function\`: 'cosine'
    }}
  `);
}

/**
 * Create or Update an Agent node.
 * agent = { a_id, name, persona, attributes }
 */
export async function createAgent(agent) {
  const { a_id, name, persona = null } = agent;

  const result = await runQuery(
    `
    MERGE (a:Agent { a_id: $a_id })
    ON CREATE SET 
        a.name = $name, 
        a.persona = $persona
    ON MATCH SET 
        a.name = $name // Optional: updates name if it changed
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
 * Create a Location node.
 * location = { l_id, name }
 */
export async function createLocation(location) {
  const { l_id, name } = location;

  const result = await runQuery(
    `
    MERGE (l:Location { l_id: $l_id })
    SET l.name = $name
    RETURN l
    `,
    { l_id, name }
  );

  return result.records[0].get('l').properties;
}

/**
 * Create a Memory node 
 * Applies OWNS relationship from its owner.
 * Links AT relationship to the location of convo. 
 */
export async function createMemory(memoryObj) {
  const { id, embedding, content, metadata } = memoryObj;
  
  const query = `
    MATCH (owner:Agent { a_id: $speaker_id })
    
    CREATE (m:Memory {
      m_id: $id,
      description: $content,
      embedding: $embedding,
      timestamp: datetime({epochSeconds: toInteger($timestamp)}),
      msg_type: $msg_type,
      location_name: $location
    })
    
    MERGE (owner)-[:OWNS]->(m)
    
    // Link to Location
    MERGE (loc:Location { name: $location })
    MERGE (m)-[:AT]->(loc)

    // Handle Audience Relationships
    WITH m
    UNWIND $audience AS audience_id
    MERGE (audience_member:Agent { a_id: audience_id })
    MERGE (m)-[:HEARD_BY]->(audience_member)
    
    RETURN m
  `;

  const params = {
    id,
    embedding: Float32Array.from(embedding),
    content,
    speaker_id: metadata.speaker_id,
    timestamp: metadata.timestamp,
    msg_type: metadata.msg_type,
    location: metadata.location,
    audience: metadata.audience || [] // Expects an array like ["Fox_01", "Bear_02"]
  };

  const result = await runQuery(query, params);
  return result.records[0].get('m').properties;
}

/**
 * Relationships
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
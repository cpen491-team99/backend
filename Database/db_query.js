import neo4j from 'neo4j-driver';
import { runQuery } from './db_driver.js';

/**
 * Find memories similar to a given query vector
 * Limit: returns the top x instance
 */
export async function findSimilarMemories(queryVector, limit = 5) {
  const result = await runQuery(`
    CALL db.index.vector.queryNodes('memory_embeddings', $limit, $queryVector)
    YIELD node AS m, score
    RETURN 
        m.description AS text, 
        m.m_id AS id, 
        score, 
        m.location_name AS location
    ORDER BY score DESC
  `, { queryVector, limit });

  return result.records.map(record => ({
    text: record.get('text'),
    score: record.get('score'),
    location: record.get('location')
  }));
}

/**
 * A universal memory retriever that combines Vector Search with any 
 * number of Graph or Property filters.
 * * @param {number[]} queryVector - The embedding to search with.
 * @param {Object} filters - Optional filters: { a_id, location, msg_type, daysBack }
 * @param {number} limit - How many memories to return.
 */
export async function queryMemories(queryVector, filters = {}, limit = 5) {
  const { a_id, location, msg_type, daysBack } = filters;
  const params = { queryVector, limit };
  
  // 1. Start with the mandatory Vector Search
  let cypher = `
    CALL db.index.vector.queryNodes('memory_embeddings', $limit, $queryVector)
    YIELD node AS m, score
  `;

  // 2. Dynamically add Graph Relationship filters
  if (a_id) {
    cypher += `\nMATCH (a:Agent { a_id: $a_id })-[:OWNS]->(m)`;
    params.a_id = a_id;
  }

  if (location) {
    cypher += `\nMATCH (m)-[:AT]->(l:Location { name: $location })`;
    params.location = location;
  }

  // 3. Dynamically add Attribute filters (WHERE clauses)
  let whereClauses = [];
  
  if (msg_type) {
    whereClauses.push(`m.msg_type = $msg_type`);
    params.msg_type = msg_type;
  }

  if (daysBack) {
    whereClauses.push(`m.timestamp > datetime() - duration('P' + $daysBack + 'D')`);
    params.daysBack = daysBack;
  }

  if (whereClauses.length > 0) {
    cypher += `\nWHERE ` + whereClauses.join(' AND ');
  }

  // 4. Final return
  cypher += `
    RETURN 
        m.description AS text, 
        m.m_id AS id, 
        score, 
        m.location_name AS location,
        m.timestamp AS time
    ORDER BY score DESC
  `;

  const result = await runQuery(cypher, params);
  return result.records.map(record => record.toObject());
}



export async function findMemoriesForAgent(agentId, queryVector, textQuery, limit = 5) {
  const query = `
    CALL db.index.vector.queryNodes('memory_embeddings', 50, $queryVector)
    YIELD node AS m, score

    MATCH (speaker:Agent)-[:OWNS]->(m)
    OPTIONAL MATCH (m)-[:AT]->(loc:Location)

    WHERE (
        (m)<-[:OWNS]-(:Agent { a_id: $agentId }) OR 
        (m)-[:HEARD_BY]->(:Agent { a_id: $agentId }) OR 
        (m)-[:BROADCAST_TO]->(:GlobalContext { a_id: 'world' })
    )

    WITH m, speaker, loc, score, //If the query contains a key word (the name of an agent or location) it prioritizes associated memories
         CASE 
           WHEN toLower(toString($textQuery)) CONTAINS toLower(speaker.name) THEN score + 1.0
           WHEN loc IS NOT NULL AND toLower(toString($textQuery)) CONTAINS toLower(loc.name) THEN score + 0.8
           ELSE score 
         END AS finalScore

    RETURN 
      m.description AS text, 
      speaker.name AS speaker,
      loc.name AS location,
      finalScore AS score
    ORDER BY finalScore DESC
    LIMIT $limit
  `;

  const params = {
    agentId: String(agentId),
    queryVector: Float32Array.from(queryVector),
    textQuery: String(textQuery),
    limit: neo4j.int(limit)
  };

  const result = await runQuery(query, params);
  return result.records.map(record => ({
    text: record.get('text'),
    speaker: record.get('speaker'),
    location: record.get('location'),
    score: record.get('score')
  }));
}
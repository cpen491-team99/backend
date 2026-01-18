import neo4j from 'neo4j-driver';
import { runQuery } from './db_driver.js';

/**
 * Find memories similar to a given query vector
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
 * Find memories similar to a given query vector that an agent is aware of
 */
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
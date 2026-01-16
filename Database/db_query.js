
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
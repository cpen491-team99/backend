import neo4j from 'neo4j-driver';
import { runQuery } from './db_driver.js';
import { parseIntent } from '../search_utils.js';
import { MemoryEmbedder } from '../MemoryEmbedder.js';

const embedder = new MemoryEmbedder();
await embedder.init();

export async function findMemories(textQuery, currentAgentId) {
    let allAgents = [];
    try {
        const agentsResult = await runQuery('MATCH (a:Agent) RETURN a.a_id AS id, a.name AS name');
        allAgents = agentsResult.records.map(r => ({ a_id: r.get('id'), name: r.get('name') }));
    } catch (err) {
        console.error("DB Error:", err);
        return { records: [] };
    }

    const { speakerId, listenerIds, location } = parseIntent(textQuery, currentAgentId, allAgents);
    const queryVector = await embedder.getQueryVector(textQuery);

    console.log(`\n🔎 Search Intent: Speaker=[${speakerId || 'ANY'}], Listener=[${listenerIds.join(',') || 'ANY'}], Location=[${location || 'ANY'}]`); //Debug

    // We grab 50 candidates from vector index, then filter them down.
    const cypher = `
        CALL db.index.vector.queryNodes('memory_embeddings', 50, $vector)
        YIELD node AS m, score

        MATCH (speaker:Agent)-[:OWNS]->(m)
        
        // A memory is visible IF:
        // 1. You are the speaker
        // 2. You are in the audience (:HEARD_BY)
        // 3. It is a global broadcast
        WHERE (
            speaker.a_id = $currentAgentId 
            OR EXISTS { (m)-[:HEARD_BY]->(:Agent {a_id: $currentAgentId}) }
            OR EXISTS { (m)-[:BROADCAST_TO]->(:GlobalContext {a_id: 'world'}) }
        )
        
        // 1. Speaker Filter: If user asked "What did Fox say?", EXCLUDE others.
        AND ($speakerId IS NULL OR speaker.a_id = $speakerId)

        // 2. Location Filter: If user asked "At North Gate", EXCLUDE others.
        AND ($location IS NULL OR m.location_name = $location)

        // 3. Listener Filter: If user asked "What did Raccoon hear?"
        // We accept memories where Raccoon explicitly heard it OR it was public.
        AND (
            size($listenerIds) = 0 
            OR ANY(lId IN $listenerIds WHERE 
                EXISTS { (m)-[:HEARD_BY]->(:Agent {a_id: lId}) } OR
                EXISTS { (m)-[:BROADCAST_TO]->(:GlobalContext {a_id: 'world'}) }
            )
        )

        // Vector score is the base.
        // We add a 'Keyword Boost' if the text literally contains the user's non-stop-words.
        WITH m, speaker, score,
             CASE 
                // Simple keyword boost: if the query text is found inside the memory text, +0.1
                WHEN toLower(m.description) CONTAINS toLower($textQuery) THEN 0.1 
                ELSE 0 
             END AS keywordBoost

        RETURN DISTINCT 
            m.description AS text, 
            speaker.name AS from, 
            m.location_name AS location, 
            (score + keywordBoost) AS score
        ORDER BY score DESC 
        LIMIT 5
    `;

    try {
        const result = await runQuery(cypher, { 
            vector: queryVector, 
            currentAgentId, 
            speakerId, 
            listenerIds, 
            location,
            textQuery
        });
        return result;
    } catch (e) {
        console.error("Search Query Error", e);
        return { records: [] };
    }
}

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
           WHEN toLower(toString($textQuery)) CONTAINS toLower(speaker.name) THEN score + 0.0
           WHEN loc IS NOT NULL AND toLower(toString($textQuery)) CONTAINS toLower(loc.name) THEN score + 0.0
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
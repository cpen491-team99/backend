import { findMemoriesForAgent } from './Database/db_query.js';
import { MemoryEmbedder } from './MemoryEmbedder.js';
import { closeDriver } from './Database/db_driver.js';

async function simpleSearch(agentId, textQuery) {
    const embedder = new MemoryEmbedder();
    
    try {
        await embedder.init();

        console.log(`\nAgent "${agentId}" is searching for: "${textQuery}"`);

        const searchObj = await embedder.createMemoryObject(textQuery, agentId, [], "search");
        
        const results = await findMemoriesForAgent(agentId, searchObj.embedding, textQuery, 5);

        if (results.length === 0) {
            console.log("No relevant memories found (or Access Denied).");
        } else {
            console.log(`Found ${results.length} relevant memories:\n`);
            results.forEach((res, i) => {
                console.log(`${i + 1}. [Score: ${res.score.toFixed(3)}]`);
                console.log(`   Text: "${res.text}"`);
                console.log(`   Loc:  ${res.location}\n`);
            });
        }

    } catch (error) {
        console.error("Search Error:", error);
    } finally {
        await closeDriver();
    }
}

// CONFIGURATION
const SEARCHING_AGENT = "Fox_01"; 
const QUERY_TEXT = "waht did the mayor bear say";

simpleSearch(SEARCHING_AGENT, QUERY_TEXT);
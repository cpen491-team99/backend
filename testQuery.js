import { queryMemories } from './Database/db_query.js'; 
import { MemoryEmbedder } from './MemoryEmbedder.js'; 
import { closeDriver } from './Database/db_driver.js';

async function performSearch() {
    const embedder = new MemoryEmbedder();
    
    try {
        // 1. Initialize the AI model
        await embedder.init();

        // 2. The User's Question
        const question = "Who watched a movie yesterday?";
        const foxId = "Fox_01";
        console.log(`\n Querying for: "${question}"`);

        // 3. Convert question to a Vector
        const queryVector = await embedder.getQueryVector(question);


        const filters = {
            //daysBack: 2, 
            a_id : foxId
        };

        const results = await queryMemories(queryVector, filters, 3);

        // 5. Display Results
        console.log("\n--- Top Relevant Memories ---");
        if (results.length === 0) {
            console.log("No matching memories found.");
        } else {
            results.forEach((res, i) => {
                console.log(`${i + 1}. [Score: ${res.score.toFixed(4)}]`);
                console.log(`   Text: "${res.text}"`);
                console.log(`   Location: ${res.location}`);
                console.log(`   Time: ${res.time}`);
                console.log('---');
            });
        }

    } catch (error) {
        console.error(" Search failed:", error);
    } finally {
        await closeDriver();
    }
}

performSearch();
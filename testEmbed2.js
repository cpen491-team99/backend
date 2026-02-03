import { initSchema, createAgent, createMemory } from './Database/db_store.js'; 
import { MemoryEmbedder } from './MemoryEmbedder.js'; 
import { closeDriver } from './Database/db_driver.js';

async function testEmbeddingFlow() {
    const embedder = new MemoryEmbedder();

    try {
        await embedder.init();
        await initSchema();

        // 1. Setup Agents
        const foxId = "Fox_01";
        const raccoonId = "Raccoon_01";
        const bearId = "Bear_02";

        await createAgent({ a_id: foxId, name: "Fox", persona: "A curious fox." });
        await createAgent({ a_id: raccoonId, name: "Raccoon", persona: "A trash-loving raccoon." });
        await createAgent({ a_id: bearId, name: "Bear", persona: "A sleepy bear." });

        console.log("🚀 Starting 4-instance memory storage...");

        const mem1 = await embedder.createMemoryObject(
            "I went to the Batman-themed cafe yesterday.",
            foxId,
            [bearId],
            "Alley",
            "chat"
        );
        await createMemory(mem1);

        const mem2 = await embedder.createMemoryObject(
            "Did you want coffee without milk?",
            foxId,
            [bearId], // 'world' acts as a placeholder for public events
            "Town-Square",
            "chat"
        );
        await createMemory(mem2);

        // // Instance 3: A discovery at the Lab
        // const mem3 = await embedder.createMemoryObject(
        //     "The encryption algorithm seems to be failing on 1024-bit keys. Need to investigate the entropy source.",
        //     foxId,
        //     [raccoonId, bearId],
        //     "Lab",
        //     "work_log"
        // );
        // await createMemory(mem3);

        // // Instance 4: A secret meeting at the Cafe
        // const mem4 = await embedder.createMemoryObject(
        //     "Meet me at 3pm tonight for the movie at the theatre.",
        //     foxId,
        //     [raccoonId],
        //     "Cafe",
        //     "private_whisper"
        // );
        // await createMemory(mem4);

        //console.log("✨ Success! 4 distinct memories stored with full graph relationships.");

    } catch (error) {
        console.error("❌ Test failed:", error);
    } finally {
        await closeDriver();
        console.log("🔌 Database connection closed.");
    }
}

testEmbeddingFlow();
import { initSchema, createAgent, createMemory } from './Database/db_store.js'; 
import { MemoryEmbedder } from './MemoryEmbedder.js'; 
import { closeDriver } from './Database/db_driver.js';

async function testEmbeddingFlow() {
    const embedder = new MemoryEmbedder();

    try {
        await embedder.init();
        await initSchema();

        const agentId = "Fox_01";
        await createAgent({
            a_id: agentId,
            name: "Fox",
            persona: "A foxy fox."
        });

        const memoryData = await embedder.createMemoryObject(
            "Amogus.",
            agentId,
            ["Raccoon_01"],
            "Alley"
        );

        const savedMemory = await createMemory(memoryData);
        console.log("✨ Success! Memory stored:", savedMemory.m_id);

    } catch (error) {
        console.error("❌ Test failed:", error);
    } finally {
        await closeDriver();
        console.log("🔌 Database connection closed.");
    }
}

testEmbeddingFlow();
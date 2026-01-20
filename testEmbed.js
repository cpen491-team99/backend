import { initSchema, createAgent, createMemory } from './Database/db_store.js'; 
import { MemoryEmbedder } from './MemoryEmbedder.js'; 
import { closeDriver } from './Database/db_driver.js';

async function testEmbeddingFlow() {
    const embedder = new MemoryEmbedder();

    try {
        await embedder.init();
        await initSchema();

        // 1. Setup all participating Agents
        console.log("Setting up agents");
        const agents = [
            { a_id: "Fox_01", name: "Fox", persona: "A foxy fox." },
            { a_id: "Raccoon_01", name: "Raccoon", persona: "Tech-savvy trash panda." },
            { a_id: "Mayor_Bear", name: "Mayor Bear", persona: "Official leader of the forest." }
        ];

        for (const agent of agents) {
            await createAgent(agent);
        }

        // 2. Define different memory scenarios
        const scenarios = [
            {
                text: "The annual Winter Feast will be held at the Town Square this Friday!",
                speaker: "Mayor_Bear",
                audience: ["world"], // Global Event
                location: "Town Hall",
                type: "announcement"
            },
            {
                text: "I think I saw a suspicious human near the north gate.",
                speaker: "Fox_01",
                audience: ["Raccoon_01"], // Private Message
                location: "North Gate",
                type: "chat"
            },
            {
                text: "The trash cans behind the cafe are surprisingly empty today. Disappointing.",
                speaker: "Raccoon_01",
                audience: ["Fox_01", "Raccoon_01"], // Small Group
                location: "Alley",
                type: "observation"
            },
            {
                text: "Attention everyone: A heavy rainstorm is approaching from the West.",
                speaker: "Mayor_Bear",
                audience: ["world"], // Another Global Event
                location: "Weather Station",
                type: "alert"
            }
        ];

        // 3. Process and Store each memory
        console.log("Processing memories...");
        for (const scene of scenarios) {
            const memoryData = await embedder.createMemoryObject(
                scene.text,
                scene.speaker,
                scene.audience,
                scene.location,
                scene.type
            );

            const saved = await createMemory(memoryData);
            console.log(`[${scene.type.toUpperCase()}] Stored: "${scene.text.substring(0, 30)}..." (ID: ${saved.m_id})`);
        }

    } catch (error) {
        console.error("Test failed:", error);
    } finally {
        await closeDriver();
        console.log("Database connection closed.");
    }
}

testEmbeddingFlow();
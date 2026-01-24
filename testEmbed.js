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
            { a_id: "Mayor_Bear", name: "Mayor Bear", persona: "Official leader of the forest." },
            { a_id: "Dr_Owl", name: "Dr Owl", persona: "A scientist" }
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
                audience: ["Fox_01"],
                location: "Alley",
                type: "observation"
            },
            {
                text: "Attention everyone: A heavy rainstorm is approaching from the West.",
                speaker: "Mayor_Bear",
                audience: ["world"], // Another Global Event
                location: "Weather Station",
                type: "alert"
            },
            {
                text: "Has anyone seen my favorite wrench? I left it somewhere near the cafe.",
                speaker: "Raccoon_01",
                audience: ["Fox_01", "Mayor_Bear"], // Group Chat
                location: "Cafe",
                type: "chat"
            },
            {
                text: "I wonder if I should tell the others about the secret tunnel I found...",
                speaker: "Fox_01",
                audience: [], // Private thought/Self-reflection
                location: "Deep Woods",
                type: "thought"
            },
            {
                text: "The annual fishing competition is starting now! First one to catch a salmon wins.",
                speaker: "Mayor_Bear",
                audience: ["world"],
                location: "Riverbank",
                type: "announcement"
            },
            {
                text: "I found a strange metallic object in the trash. It looks like part of a drone.",
                speaker: "Raccoon_01",
                audience: ["Fox_01"],
                location: "Alley",
                type: "observation"
            },
            {
                text: "The bridge is a bit slippery from the mist. Everyone be careful crossing today.",
                speaker: "Fox_01",
                audience: ["world"],
                location: "Old Bridge",
                type: "alert"
            },
            {
                text: "The constellation Orion is particularly bright tonight. A perfect viewing condition.",
                speaker: "Dr_Owl",
                audience: ["Fox_01"],
                location: "Observatory",
                type: "chat"
            },
            {
                text: "My telescope lens is cracked! I suspect a rock was thrown at it.",
                speaker: "Dr_Owl",
                audience: ["Mayor_Bear"],
                location: "Town Hall",
                type: "complaint"
            },
            {
                text: "I am proud to announce the creation of the Golden Acorn Award for community service!",
                speaker: "Mayor_Bear",
                audience: ["world"],
                location: "Town Hall",
                type: "announcement"
            },
            {
                text: "I saw a literal golden acorn buried under the old oak tree. It looked delicious.",
                speaker: "Raccoon_01",
                audience: ["Fox_01"],
                location: "Deep Woods",
                type: "gossip"
            },
            {
                text: "Don't tell the Fox, but I'm planning a surprise party for him.",
                speaker: "Raccoon_01",
                audience: ["Dr_Owl"],
                location: "Bakery",
                type: "secret"
            },
            {
                text: "I feel really guilty about dropping that pie earlier...",
                speaker: "Fox_01",
                audience: [],
                location: "Kitchen",
                type: "thought"
            },
            {
                text: "I dropped a whole blueberry pie! It made a huge mess on the floor.",
                speaker: "Fox_01",
                audience: ["Raccoon_01"],
                location: "Kitchen",
                type: "chat"
            },
            {
                text: "The water level at the river is dangerously high.",
                speaker: "Dr_Owl",
                audience: ["world"],
                location: "Riverbank",
                type: "alert"
            },
            {
                text: "The river is so calm and peaceful for fishing today.",
                speaker: "Mayor_Bear",
                audience: ["Fox_01"],
                location: "Riverbank",
                type: "chat"
            }
        ];

        // 3. Process and Store each memory
        console.log("Processing memories...");

        const nameLookup = Object.fromEntries(agents.map(a => [a.a_id, a.name]));

        for (const scene of scenarios) {
            const speakerName = nameLookup[scene.speaker] || scene.speaker;

            const audienceNames = scene.audience.map(id => nameLookup[id] || id);

            const memoryData = await embedder.createMemoryObject(
                scene.text,
                speakerName,
                scene.speaker,
                audienceNames,
                scene.location,
                scene.type
            );

            memoryData.metadata.audienceIds = scene.audience;

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
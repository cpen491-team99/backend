import { findMemories } from './Database/db_query.js';
import { closeDriver } from './Database/db_driver.js';

async function runTests() {
    const testID = "Fox_01";

    const testCases = [
        {
            label: "Subject Search: What the Mayor said",
            query: "What did the Mayor Bear say about the weather?",
            expectedSpeaker: "Mayor Bear"
        },
        {
            label: "Direct Interaction: What I (Fox) said TO the Bear",
            query: "What did I say to the Mayor Bear?",
            expectedSpeaker: "Fox"
        },
        {
            label: "Audience Search: What the Raccoon heard",
            query: "What did the Raccoon hear about the suspicious human?",
            expectedSpeaker: "Fox" // Because Fox said it, Raccoon heard it
        },
        {
            label: "General Vector Search (No specific IDs)",
            query: "Tell me about the trash cans.",
            expectedSpeaker: "Raccoon"
        },
        {
            label: "Location Search: What happened at the North Gate?",
            query: "Tell me about what was seen at the North Gate.",
            expectedLocation: "North Gate"
        },
        {
            label: "Complex Directional: What did the Mayor say to everyone (the world)?",
            query: "What did the Mayor Bear broadcast to the world?",
            expectedSpeaker: "Mayor Bear"
        },
        {
            label: "Private Context Check: My private thoughts",
            query: "What are my secret thoughts about tunnels?",
            expectedSpeaker: "Fox" // Verifies the searcher can find their own thoughts
        },
        {
            label: "Multi-Agent Listening: What did the Fox and Bear both hear?",
            query: "What did the Mayor Bear and I both hear about the wrench?",
            expectedSpeaker: "Raccoon" // Raccoon spoke, both Fox and Bear were audience
        },
        {
            label: "Temporal Search: Recent events (Vector + Time)",
            query: "What just happened recently with the rain?",
            expectedSpeaker: "Mayor Bear"
        },
        {
            label: "Inverse Interaction: What did Dr Owl tell ME?",
            query: "What did Dr Owl say to me about the stars?",
            expectedSpeaker: "Dr Owl",
            description: "Tests 'To Me' -> Listener=CurrentAgent"
        },
        {
            label: "Ambiguity Check 1: The Award (Mayor)",
            query: "What did the Mayor say about the Golden Acorn?",
            expectedSpeaker: "Mayor_Bear",
            expectedTextContains: "Award",
            description: "Should ignore Raccoon's food comment despite same keywords"
        },
        {
            label: "Ambiguity Check 2: The Object (Raccoon)",
            query: "What did Raccoon say about the Golden Acorn?",
            expectedSpeaker: "Raccoon_01",
            expectedTextContains: "delicious",
            description: "Should ignore Mayor's award comment"
        },
        {
            label: "Security Test: The Surprise Party",
            query: "What did Raccoon tell Dr Owl about the party?",
            expectedResults: 0,
            description: "CRITICAL: Fox was not the audience. Should return NOTHING."
        },
        {
            label: "Private Thoughts: My Guilt",
            query: "What are my thoughts about the pie?",
            expectedSpeaker: "Fox_01",
            expectedTextContains: "guilty",
            description: "Tests searching for internal monologue"
        },
        {
            label: "Location Conflict: The River (Safety)",
            query: "What warnings were given about the Riverbank?",
            expectedSpeaker: "Dr Owl",
            expectedTextContains: "dangerously high",
            description: "Vector search should prioritize 'warning' (Dr Owl) over 'peaceful' (Mayor)"
        },
        {
            label: "Location Search: The Observatory",
            query: "What happened at the Observatory?",
            expectedSpeaker: "Dr Owl",
            description: "Tests implicit location extraction for 'Observatory'"
        },
        {
            label: "Broadcast: Who spoke to the world?",
            query: "What did Dr Owl broadcast to everyone?",
            expectedSpeaker: "Dr Owl",
            expectedTextContains: "river",
            description: "Tests the 'Priority 1' Broadcast logic in search_utils"
        }
    ];

    console.log("Starting Directional Search Tests...\n");

    for (const test of testCases) {
        console.log(`--- Test: ${test.label} ---`);
        console.log(`Query: "${test.query}"`);

        try {
            const results = await findMemories(test.query, testID);

            if (results.records.length === 0) {
                console.log("No memories found.");
            } else {
                results.records.forEach((rec, i) => {
                    const text = rec.get('text');
                    const from = rec.get('from');
                    const score = rec.get('score').toFixed(3);
                    console.log(`${i + 1}. [Score: ${score}] ${from}: "${text}"`);
                });
            }
        } catch (err) {
            console.error("Test Error:", err.message);
        }
        console.log("\n");
    }

    await closeDriver();
    console.log("Testing Complete.");
}

runTests();
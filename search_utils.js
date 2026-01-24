// search_utils.js

const locationAliases = {
    "north gate": "North Gate",
    "gate": "North Gate",
    "cafe": "Cafe",
    "town hall": "Town Hall",
    "square": "Town Hall",
    "bridge": "Old Bridge",
    "woods": "Deep Woods",
    "river": "Riverbank",
    "alley": "Alley",
    "station": "Weather Station",
    "observatory": "Observatory"
};

export function parseIntent(text, currentAgentId, allAgents) {
    const lowerText = text.toLowerCase().trim();
    
    let speakerId = null;
    let listenerIds = [];
    let location = null;
    let searchType = 'general'; 

    // --- 1. DETECT ENTITIES ---
    // We map names to their index in the string to know WHO came first (Subject vs Object)
    const mentionedAgents = allAgents
        .map(a => ({ ...a, index: lowerText.indexOf(a.name.toLowerCase()) }))
        .filter(a => a.index !== -1)
        .sort((a, b) => a.index - b.index); // Sort by appearance order

    const hasSelf = /\b(i|me|my|mine)\b/.test(lowerText);
    const selfIndex = lowerText.search(/\b(i|me|my|mine)\b/);

    // --- 2. LOCATION ---
    for (const [alias, formalName] of Object.entries(locationAliases)) {
        if (lowerText.includes(alias)) {
            location = formalName;
            break;
        }
    }

    // --- 3. DETERMINE INTENT ---

    // A. BROADCASTS ("What did Dr_Owl broadcast?")
    if (lowerText.includes("world") || lowerText.includes("everyone") || lowerText.includes("broadcast")) {
        searchType = 'broadcast';
        listenerIds = ['world'];

        // Logic: The First Agent mentioned is usually the Broadcaster
        // "What did [Speaker] broadcast..."
        if (mentionedAgents.length > 0) {
            speakerId = mentionedAgents[0].a_id;
        } else if (hasSelf) {
            speakerId = currentAgentId;
        }
    }

    // B. DIRECT INTERACTIONS ("What did Raccoon tell Dr_Owl?")
    else if (lowerText.includes(" to ") || lowerText.includes(" tell ")) {
        searchType = 'interaction';
        
        // Find the "split point" (the word 'to' or 'tell')
        const splitIndex = lowerText.search(/ to | tell /);

        // SPEAKER: Usually appears BEFORE the split (Subject)
        const subjectAgent = mentionedAgents.find(a => a.index < splitIndex);
        if (subjectAgent) {
            speakerId = subjectAgent.a_id;
        } else if (hasSelf && selfIndex < splitIndex) {
            speakerId = currentAgentId;
        }

        // LISTENER: Usually appears AFTER the split (Object)
        const objectAgents = mentionedAgents.filter(a => a.index > splitIndex);
        if (objectAgents.length > 0) {
            objectAgents.forEach(a => listenerIds.push(a.a_id));
        } else if (hasSelf && selfIndex > splitIndex) {
            listenerIds.push(currentAgentId);
        }
    }

    // C. PASSIVE LISTENING ("What did Dr_Owl hear?")
    else if (lowerText.includes("hear")) {
        searchType = 'interaction';
        // In "What did X hear", X is the LISTENER, Speaker is usually NULL (anyone)
        if (hasSelf) listenerIds.push(currentAgentId);
        mentionedAgents.forEach(a => listenerIds.push(a.a_id));
    }

    // D. GENERAL/SUBJECT ("What did Mayor say?")
    else if (lowerText.includes(" say") || lowerText.includes(" said") || lowerText.includes("thought")) {
        // "What did [Speaker] say?"
        if (mentionedAgents.length > 0) {
            speakerId = mentionedAgents[0].a_id;
        } else if (hasSelf) {
            speakerId = currentAgentId;
        }
    }

    return { speakerId, listenerIds, location, searchType };
}
import type { ChatMessage } from "./chat"

export type Room = {
    id: string,
    name: string,
    occupants: string[],
    icon: string, // Using emoji for now for room icons
    messages: ChatMessage[]
}


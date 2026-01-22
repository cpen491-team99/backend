// Library

import type { ChatMessage } from "../types/chat" // All unused for now, moved functionality to ./rooms.ts

export const initialCafeMessages: ChatMessage[] = [ // For testing, this will be gathered from backend
    { id: "1", author: "Raccoon", content: "Man, I just can't stand the weather recently. The rain always makes me feel sad." },
    { id: "2", author: "Cat", content: "Really? I've always enjoyed the rain. My plants love it too, I don't even have to water my garden!" },
    { id: "3", author: "Raccoon", content: "I wish I felt the same. I just want the sun to come back so I can keep playing basketball, me and Rhino were supposed to play today but now we can't." }
]

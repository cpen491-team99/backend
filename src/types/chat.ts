export type ChatMessage = {
    id: string, // Maybe int?
    author: string, // Maybe author can be like system for "Agent joined" messages? Or can add message types in here as well.
    content: string,
    // timestamp?: number -> if necessary
}
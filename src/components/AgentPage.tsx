import { useState } from "react"
import { ChatArea } from "./ChatArea"
import type { ChatMessage } from "../types/chat"
import { ChatInput } from "./ChatInput"
import { v4 as uuidv4 } from "uuid"
import "../styles/ChatArea.css"

export function AgentChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([])

  const userName = "You"
  const agentName = "Agent"

  const handleSend = (text: string) => {
    if (!text) return

    const newMessage: ChatMessage = {
      id: uuidv4(),
      author: userName,
      content: text
    }

    // Add user message
    setMessages(prev => [...prev, newMessage])

    // Simulate agent reply (echo for now)
    const agentReply = `Heard message: ${text}`
    const agentMessage: ChatMessage = {
      id: uuidv4(),
      author: agentName,
      content: agentReply // just repeats user message for now
    }

    setTimeout(() => {
      setMessages(prev => [...prev, agentMessage])
    }, 300) // simulate small delay
  }

  return (
    //<div className="agent-chat-page">
      <div className="chat-container">
        <ChatArea messages={messages} />
      

      <ChatInput onSend={handleSend} />
      </div>
   //</div>
  )
}
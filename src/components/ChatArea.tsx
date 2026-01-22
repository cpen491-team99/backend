import type { ChatMessage } from "../types/chat"
import "../styles/ChatArea.css"
type ChatAreaProps = {
    messages: ChatMessage[],
}

export function ChatArea({ messages }: ChatAreaProps) {
    if (messages.length === 0) return null

    const leftAuthor = messages[0].author

    return (
    <div className="chat-area">
      <div className="chat-messages">
        {messages.map(msg => {
          const isLeft = msg.author === leftAuthor

          return (
            <div
              key={msg.id}
              className={`chat-message ${isLeft ? "left" : "right"}`}
            >
              <span className="chat-author">{msg.author}</span>

              <div className="chat-bubble">
                {msg.content}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
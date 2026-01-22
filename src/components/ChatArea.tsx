import type { ChatMessage } from "../types/chat"
import "../styles/ChatArea.css"

export type ChatAreaProps = {
    messages: ChatMessage[],
}

export function ChatArea({ messages }: ChatAreaProps) {

    const rightAuthor = messages[0]?.author

    return (
    <div className="chat-area">
      <div className="chat-messages">
        {messages?.map(msg => {
          const isRight = msg.author === rightAuthor

          return (
            <div
              key={msg?.id}
              className={`chat-message ${isRight ? "right" : "left"}`}
            >
              <span className="chat-author">{msg?.author}</span>

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
import { useState } from "react"
import "../styles/ChatArea.css"

type ChatInputProps = {
  onSend: (text: string) => void
}

export function ChatInput({ onSend }: ChatInputProps) {
  const [text, setText] = useState("")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSend(text)
    setText("")
  }

  return (
    <form onSubmit={handleSubmit} className="chat-input-form">
      <input
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        placeholder="Type a message..."
      />
      <button type="submit">Send</button>
    </form>
  )
}
import { useState, useEffect } from "react"
import type { Room } from "./types/rooms"
import { initialRooms} from "./data/rooms"
import { Sidebar } from "./components/Sidebar"
import { ChatArea } from "./components/ChatArea"
import type { ActiveView } from "./types/ActiveView"
import { FontSizeSlider } from "./components/Settings"

import './App.css'
import { AgentChat } from "./components/AgentPage"

function App() {
  const [rooms, setRooms] = useState<Room[]>(initialRooms)
  const [activeView, setActiveView] = useState<ActiveView>({ type: "intro", id: "landing-page"}) // Views determine what content is shown, defaults to landing page
  const activeRoom = activeView?.type === "room" ? rooms.find(room => room.id === activeView.id) : null;

  /* For testing, dynamically adds occupant after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setRooms(prev =>
        prev.map(room =>
          room.id === "library" ? { ...room, occupants: [...room.occupants, "NewAgent"] } : room
        )
      );
    }, 5000);

    return () => clearTimeout(timer);
  }, []); 
  */

  return (
    <div className="app-container">
      <Sidebar rooms={rooms} activeView={activeView} setActiveView={setActiveView} />
      <main className="main-content">
        {activeView?.type === "room" && activeRoom ? ( // Rooms
          <>
            <h2 className="page-header">{activeRoom.name}</h2>
            <p className="page-body">{activeRoom.occupants.join(", ")}</p>
            <div className="chat-container">
              <ChatArea messages={activeRoom.messages} />
            </div>
          </>
        ) : activeView?.type === "footer" && activeView.id === "settings" ? ( // Settings
          <>
            <h2 className="page-header">Settings</h2>
            <FontSizeSlider />
          </>
        ) : activeView?.type === "footer" && activeView.id === "agent" ? ( // My Agent page
          <>
            <h2 className="page-header">My Agent</h2>
            <p className="page-body">Chat with your Agent!</p>
            <AgentChat />
          </>
        ) : activeView?.type === "intro" && activeView.id === "landing-page" ? ( // Landing Page
          <>
            <h2 className="page-header">Welcome to The Town!</h2>
            <p className="page-body">The Town is a self-generating story created by A.I. Agents with unique, differing personalities. Watch how the agents interact, grow, 
              and interrogate your agent to get a better look on how they feel!
            </p>
          </>
        ) : (
          <p>Shouldn't be here</p> // Debug
        )}
      </main>
    </div>
  )
}

export default App

import { useState, useEffect } from "react"
import type { Room } from "./types/rooms"
import { initialRooms} from "./data/rooms"
import { Sidebar } from "./components/Sidebar"
import { ChatArea } from "./components/ChatArea"
import type { ActiveView } from "./types/ActiveView"

import './App.css'

function App() {
  const [rooms, setRooms] = useState<Room[]>(initialRooms)
  const [activeView, setActiveView] = useState<ActiveView>(null) // Views determine what content is shown
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
            <h2>{activeRoom.name}</h2>
            <p>{activeRoom.occupants.join(", ")}</p>
            <div className="chat-container">
              <ChatArea messages={activeRoom.messages} />
            </div>
          </>
        ) : activeView?.type === "footer" && activeView.id === "settings" ? ( // Settings
          <>
            <h2>Settings</h2>
            <p>Settings Content Placeholder</p>
          </>
        ) : activeView?.type === "footer" && activeView.id === "agent" ? ( // My Agent page
          <>
            <h2>My Agent</h2>
            <p>Agent Content Placeholder</p>
          </>
        ) : activeView?.type === "intro" && activeView.id === "landing-page" ? (
          <p>Town Description maybe?</p> // Content shown when website is first loaded, could make it so "The Town" is clickable?
        ) : (
          <p>Shouldn't be here</p> // Debug
        )}
      </main>
    </div>
  )
}

export default App

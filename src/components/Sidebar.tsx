import { RoomItem } from "./RoomItem"
import type { Room } from "../types/rooms"
import { FaCog, FaUser} from "react-icons/fa"
import type { ActiveView } from "../types/ActiveView"
import { SidebarHeader } from "./Header"

import "../styles/Sidebar.css"

type SidebarProps = {
  rooms: Room[],
  activeView: ActiveView,
  setActiveView: (v: ActiveView) => void
}

export function Sidebar({ rooms, activeView, setActiveView }: SidebarProps) {

  return (
    <aside className="sidebar">
      {/* Header */}
      <SidebarHeader activeView={activeView} setActiveView={setActiveView} />

      {/* Rooms */}
      <nav className="sidebar-rooms">
        {rooms.map((room) => (
          <RoomItem
            key={room.id}
            icon={room.icon}
            name={room.name}
            occupants={room.occupants}
            active={activeView?.type === "room" && activeView.id === room.id}
            onClick={() => setActiveView({ type: "room", id: room.id })}
          />
        ))}
      </nav>

      {/* Footer Buttons */}
      <SidebarFooter activeView={activeView} setActiveView={setActiveView} />
    </aside>
  )
}

// SidebarFooter
type SidebarFooterProps = {
  activeView: ActiveView,
  setActiveView: (v: ActiveView) => void
}

function SidebarFooter({ activeView, setActiveView }: SidebarFooterProps) {
  return (
    <div className="sidebar-footer">
      <button
        className={activeView?.type === "footer" && activeView.id === "settings" ? "active" : ""}
        onClick={() => setActiveView({ type: "footer", id: "settings" })}
      >
        <FaCog className="button-icon" />
        Settings
      </button>

      <button
        className={activeView?.type === "footer" && activeView.id === "agent" ? "active" : ""}
        onClick={() => setActiveView({ type: "footer", id: "agent" })}
      >
        <FaUser className="button-icon" />
        My Agent
      </button>
    </div>
  )
}
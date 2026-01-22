import type { ActiveView } from "../types/ActiveView"
import { FaHome } from "react-icons/fa"

type SidebarHeaderProps = {
    activeView: ActiveView,
    setActiveView: (v: ActiveView) => void
}

export function SidebarHeader({ activeView, setActiveView }: SidebarHeaderProps) {
    return (
        <button 
            className={`sidebar-header-button ${activeView?.type === "intro" && activeView.id === "landing-page" ? "active" : ""}`} // Is it active or not
            onClick={() => setActiveView({ type: "intro", id: "landing-page"})}
        >
            The Town
            <FaHome className="sidebar-logo" />
        </button>
        
    )
}
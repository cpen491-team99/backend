import "../styles/RoomItem.css"

type RoomItemProps = {
    icon: string,
    name: string,
    occupants: string[],
    active?: boolean, //May not be necessary depending on how we want to handle the rooms
    onClick?: () => void
}

export function RoomItem({icon, name, occupants, active = false, onClick }: RoomItemProps) {
    return (
        <div className={`room-item ${active ? "active" : ""}`} onClick={onClick}>
            <span className="room-icon">{icon}</span>
            <div className="room-info">
                <span className="room-name">{name}</span>
                <span className="room-occupants">{occupants.length > 0 ? `${occupants.join(", ")}` : "No one here..."}</span>
            </div>
        </div>
    )
}
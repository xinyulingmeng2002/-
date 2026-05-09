import type { RoomRecord } from "../../api/client";

type RoomListProps = {
  rooms: RoomRecord[];
  activeRoomId: string;
  onSelect: (roomId: string) => void;
};

export function RoomList({ rooms, activeRoomId, onSelect }: RoomListProps) {
  if (rooms.length === 0) {
    return <p className="empty-state">还没有可用房间。</p>;
  }

  return (
    <div className="room-list">
      {rooms.map((room) => (
        <button
          key={room.id}
          type="button"
          className={`room-card${room.id === activeRoomId ? " room-card--active" : ""}`}
          onClick={() => onSelect(room.id)}
        >
          <span className="room-card__name">{room.name}</span>
          <span className="room-card__meta">{room.id}</span>
        </button>
      ))}
    </div>
  );
}

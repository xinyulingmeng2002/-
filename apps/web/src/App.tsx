import { ApiClient } from "./api/client";
import { RoomShell } from "./features/rooms/room-shell";

const apiClient = new ApiClient();

export function App() {
  return <RoomShell apiClient={apiClient} />;
}

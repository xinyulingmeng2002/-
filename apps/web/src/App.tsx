import { useState } from "react";

import { ApiClient } from "./api/client";
import { AgentWorkspacePage } from "./features/agent-workspace/agent-workspace-page";
import { RoomShell } from "./features/rooms/room-shell";

const apiClient = new ApiClient();

export function App() {
  const [search, setSearch] = useState(window.location.search);
  const view = new URLSearchParams(search).get("view");

  if (view === "agent-workspace") {
    return <AgentWorkspacePage />;
  }

  return (
    <RoomShell
      apiClient={apiClient}
      onOpenAgentWorkspace={(roomId) => {
        const params = new URLSearchParams(window.location.search);
        params.set("view", "agent-workspace");
        params.set("roomId", roomId);
        window.history.pushState({}, "", `${window.location.pathname}?${params.toString()}`);
        setSearch(window.location.search);
      }}
    />
  );
}

type WatchEvent = {
  eventId?: unknown;
  kind?: unknown;
  createdAt?: unknown;
  attentionTags?: unknown;
  payload?: {
    body?: unknown;
    speakerDisplayName?: unknown;
    speakerParticipantId?: unknown;
  };
};

type WatchBatch = {
  items?: unknown;
  nextCursor?: unknown;
};

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function formatBody(body: unknown): string {
  if (typeof body !== "string") {
    return "";
  }

  return body
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .join(" / ");
}

function formatSpeaker(event: WatchEvent): string | undefined {
  const displayName = asString(event.payload?.speakerDisplayName);
  const participantId = asString(event.payload?.speakerParticipantId);

  if (displayName && participantId && displayName !== participantId) {
    return `${displayName} (${participantId})`;
  }

  return displayName ?? participantId;
}

function formatAttentionTags(event: WatchEvent): string {
  const tags = Array.isArray(event.attentionTags)
    ? event.attentionTags.filter((tag): tag is string => typeof tag === "string" && tag.length > 0)
    : [];

  return tags.length > 0 ? `[${tags.join(",")}] ` : "";
}

function formatMessageEvent(event: WatchEvent): string | undefined {
  const body = formatBody(event.payload?.body);
  if (!body) {
    return undefined;
  }

  const parts = [
    formatAttentionTags(event),
    asString(event.createdAt) ? `${asString(event.createdAt)} ` : "",
    formatSpeaker(event) ? `${formatSpeaker(event)}: ` : "",
    body
  ];

  return `- ${parts.join("")}`;
}

function formatFallbackEvent(event: WatchEvent, index: number): string {
  const eventId = asString(event.eventId) ?? `event-${index + 1}`;
  const kind = asString(event.kind) ?? "event";
  return `- ${formatAttentionTags(event)}${eventId} ${kind}`.trimEnd();
}

export function formatWatchBatchAsTranscript(batch: unknown): string {
  const items = (batch as WatchBatch)?.items;
  const lines = ["### Room Events"];

  if (Array.isArray(items)) {
    items.forEach((item, index) => {
      const event = item as WatchEvent;
      lines.push(formatMessageEvent(event) ?? formatFallbackEvent(event, index));
    });
  }

  const nextCursor = (batch as WatchBatch)?.nextCursor;
  if (typeof nextCursor === "string" && nextCursor.length > 0) {
    lines.push(`nextCursor: ${nextCursor}`);
  }

  return lines.join("\n");
}

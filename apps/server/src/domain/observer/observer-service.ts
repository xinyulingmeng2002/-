import type { WorkMemoryMessage } from "../memory/work-memory-store";

type MessageReader = {
  listRoomMessages(roomId: string): WorkMemoryMessage[];
};

export type RepeatedQuestionDetection = {
  question: string;
  occurrences: number;
  speakerParticipantIds: string[];
};

export type DuplicateTopicHint = {
  topic: string;
  occurrences: number;
};

export type RoomSummaryStub = {
  messageCount: number;
  participantCount: number;
  latestMessageAt: string | null;
  stub: string;
};

export type ObserverSnapshot = {
  repeatedQuestions: RepeatedQuestionDetection[];
  duplicateTopicHints: DuplicateTopicHint[];
  roomSummary: RoomSummaryStub;
};

type ObserverServiceOptions = {
  messageService: MessageReader;
};

const QUESTION_ENDING_PATTERN = /[?？]\s*$/;
const TRAILING_PUNCTUATION_PATTERN = /[?!.,;:，。！？；：\s]+$/g;
const TOKEN_SPLIT_PATTERN = /[^a-z0-9]+/i;
const CJK_SEGMENT_PATTERN = /[\u3400-\u9fff]{2,}/g;
const STOP_WORDS = new Set([
  "about",
  "after",
  "are",
  "been",
  "but",
  "can",
  "could",
  "from",
  "have",
  "include",
  "into",
  "just",
  "need",
  "should",
  "still",
  "that",
  "the",
  "their",
  "them",
  "there",
  "they",
  "this",
  "until",
  "what",
  "when",
  "where",
  "which",
  "who",
  "will",
  "with",
  "would"
]);
const CJK_STOP_WORDS = new Set(["今天", "这个", "那个", "我们", "你们", "一下", "已经"]);

function normalizeWhitespace(input: string): string {
  return input.trim().replace(/\s+/g, " ");
}

function normalizeQuestion(body: string): string {
  return normalizeWhitespace(body).toLowerCase().replace(TRAILING_PUNCTUATION_PATTERN, "");
}

function tokenize(body: string): string[] {
  const latinTokens = body
    .toLowerCase()
    .split(TOKEN_SPLIT_PATTERN)
    .map((token) => token.trim())
    .filter((token) => token.length >= 4 && !STOP_WORDS.has(token));

  const cjkTokens: string[] = [];
  for (const segment of body.match(CJK_SEGMENT_PATTERN) ?? []) {
    for (let index = 0; index <= segment.length - 2; index += 1) {
      const token = segment.slice(index, index + 2);
      if (!CJK_STOP_WORDS.has(token)) {
        cjkTokens.push(token);
      }
    }
  }

  return [...new Set([...latinTokens, ...cjkTokens])];
}

function buildRepeatedQuestions(messages: WorkMemoryMessage[]): RepeatedQuestionDetection[] {
  const repeatedByQuestion = new Map<
    string,
    { question: string; occurrences: number; speakerParticipantIds: Set<string> }
  >();

  for (const message of messages) {
    if (!QUESTION_ENDING_PATTERN.test(message.body)) {
      continue;
    }

    const normalizedQuestion = normalizeQuestion(message.body);
    const current = repeatedByQuestion.get(normalizedQuestion);

    if (current) {
      current.occurrences += 1;
      current.speakerParticipantIds.add(message.speakerParticipantId);
      continue;
    }

    repeatedByQuestion.set(normalizedQuestion, {
      question: normalizeWhitespace(message.body),
      occurrences: 1,
      speakerParticipantIds: new Set([message.speakerParticipantId])
    });
  }

  return [...repeatedByQuestion.values()]
    .filter((entry) => entry.occurrences > 1)
    .map((entry) => ({
      question: entry.question,
      occurrences: entry.occurrences,
      speakerParticipantIds: [...entry.speakerParticipantIds]
    }));
}

function buildDuplicateTopicHints(messages: WorkMemoryMessage[]): DuplicateTopicHint[] {
  const topicCounts = new Map<string, number>();

  for (const message of messages) {
    for (const token of tokenize(message.body)) {
      topicCounts.set(token, (topicCounts.get(token) ?? 0) + 1);
    }
  }

  return [...topicCounts.entries()]
    .filter(([, occurrences]) => occurrences > 1)
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([topic, occurrences]) => ({ topic, occurrences }));
}

function buildRoomSummary(roomId: string, messages: WorkMemoryMessage[]): RoomSummaryStub {
  const latestMessage = messages.at(-1);
  const participantCount = new Set(messages.map((message) => message.speakerParticipantId)).size;

  if (!latestMessage) {
    return {
      messageCount: 0,
      participantCount: 0,
      latestMessageAt: null,
      stub: `Room ${roomId} has 0 messages from 0 participants.`
    };
  }

  return {
    messageCount: messages.length,
    participantCount,
    latestMessageAt: latestMessage.timestamp,
    stub: `Room ${roomId} has ${messages.length} messages from ${participantCount} participants. Latest message: "${latestMessage.body}"`
  };
}

export class ObserverService {
  private readonly messageService: MessageReader;

  constructor(options: ObserverServiceOptions) {
    this.messageService = options.messageService;
  }

  inspectRoom(roomId: string): ObserverSnapshot {
    const messages = this.messageService.listRoomMessages(roomId);

    return {
      repeatedQuestions: buildRepeatedQuestions(messages),
      duplicateTopicHints: buildDuplicateTopicHints(messages),
      roomSummary: buildRoomSummary(roomId, messages)
    };
  }
}

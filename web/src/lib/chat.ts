export interface Reaction {
  emoji: string;
  count: number;
  mine: boolean;
}

export interface Message {
  id: string;
  seq: number;
  conversation_id: string;
  sender_id: string | null;
  sender_nickname: string | null;
  body: string;
  attachment_url: string | null;
  created_at: string;
  reactions?: Reaction[];
  optimistic?: boolean;
}

export interface HistoryPage {
  messages: Message[];
  nextCursor: string | null;
}

export const REACTION_EMOJIS = ["👍", "❤️", "😂", "🎮", "🔥", "😮", "😢"];

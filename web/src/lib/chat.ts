export interface Message {
  id: string;
  seq: number;
  conversation_id: string;
  sender_id: string | null;
  sender_nickname: string | null;
  body: string;
  created_at: string;
  optimistic?: boolean;
}

export interface HistoryPage {
  messages: Message[];
  nextCursor: string | null;
}

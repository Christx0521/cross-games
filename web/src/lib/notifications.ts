export interface Notification {
  id: string;
  seq: number;
  user_id: string;
  actor_id: string | null;
  actor_nickname: string | null;
  actor_avatar: string | null;
  type: string;
  entity_type: string;
  entity_id: string | null;
  preview: string;
  read_at: string | null;
  created_at: string;
}

export interface NotificationsPage {
  notifications: Notification[];
  nextCursor: string | null;
}

// Texto de la acción según el tipo, para mostrar junto al nick del actor.
export function notificationAction(type: string): string {
  switch (type) {
    case "mention":
      return "te mencionó";
    case "post_like":
      return "le gustó tu publicación";
    case "post_comment":
      return "comentó tu publicación";
    case "thread_comment":
      return "comentó en tu hilo";
    default:
      return "interactuó contigo";
  }
}

export function notificationIcon(type: string): string {
  switch (type) {
    case "mention":
      return "@";
    case "post_like":
      return "❤️";
    case "post_comment":
    case "thread_comment":
      return "💬";
    default:
      return "🔔";
  }
}

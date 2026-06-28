import { useState, type ReactNode } from "react";
import { useAuth } from "../auth/AuthContext.tsx";
import type { OpenChat } from "../lib/nav.ts";
import { ChatList } from "./ChatList.tsx";
import { ChatView } from "../pages/ChatView.tsx";
import { Friends } from "../pages/Friends.tsx";
import { Groups } from "../pages/Groups.tsx";
import { Forums } from "../pages/Forums.tsx";
import { Profile } from "../pages/Profile.tsx";
import { EditProfile } from "../pages/EditProfile.tsx";

type Section = "chats" | "friends" | "forums" | "profile";

const NAV: Array<{ id: Section; icon: string; label: string }> = [
  { id: "chats", icon: "💬", label: "Chats" },
  { id: "friends", icon: "👥", label: "Amigos" },
  { id: "forums", icon: "🌐", label: "Foros" },
  { id: "profile", icon: "👤", label: "Perfil" },
];

function Placeholder({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-[var(--color-muted)] gap-2">
      <span className="text-5xl">🌸</span>
      <p>{children}</p>
    </div>
  );
}

export function AppShell() {
  const { user, logout } = useAuth();
  const [section, setSection] = useState<Section>("chats");
  const [chat, setChat] = useState<OpenChat | null>(null);
  const [chatsPanel, setChatsPanel] = useState<"chat" | "groups">("chat");
  const [profileMode, setProfileMode] = useState<"view" | "edit">("view");

  function openChat(c: OpenChat) {
    setChat(c);
    setChatsPanel("chat");
    setSection("chats");
  }

  function renderColumn(): ReactNode {
    if (section === "chats") {
      return (
        <ChatList
          activeId={chat?.conversationId}
          onOpenChat={(c) => { setChat(c); setChatsPanel("chat"); }}
          onManageGroups={() => setChatsPanel("groups")}
        />
      );
    }
    return null; // amigos, foros y perfil ocupan el panel completo
  }

  function renderPanel(): ReactNode {
    if (section === "chats") {
      if (chatsPanel === "groups") return <Groups onOpenChat={openChat} />;
      if (chat && !chat.isForum) {
        return <ChatView key={chat.conversationId} conversationId={chat.conversationId} title={chat.title} />;
      }
      return <Placeholder>Elige un chat o crea un grupo</Placeholder>;
    }
    if (section === "friends") {
      return <Friends onOpenChat={openChat} />;
    }
    if (section === "forums") {
      if (chat && chat.isForum) {
        return (
          <ChatView
            key={chat.conversationId}
            conversationId={chat.conversationId}
            title={chat.title}
            isForum
            forumId={chat.forumId}
            onBack={() => setChat(null)}
          />
        );
      }
      return (
        <Forums
          onOpenForum={(f) =>
            setChat({ conversationId: f.conversationId, title: f.title, isForum: true, forumId: f.forumId })
          }
        />
      );
    }
    // profile
    if (profileMode === "edit") {
      return <EditProfile onBack={() => setProfileMode("view")} />;
    }
    return <Profile nickname={user!.nickname} onEdit={() => setProfileMode("edit")} />;
  }

  const column = renderColumn();

  return (
    <div className="flex h-screen bg-[var(--color-bg)]">
      {/* Rail */}
      <nav className="w-16 flex flex-col items-center gap-2 py-3 bg-[var(--color-surface)] border-r border-[var(--color-border)]">
        <div className="text-2xl mb-2">🌸</div>
        {NAV.map((item) => (
          <button
            key={item.id}
            onClick={() => setSection(item.id)}
            title={item.label}
            className={`w-11 h-11 rounded-xl flex items-center justify-center text-xl transition-colors ${
              section === item.id
                ? "bg-[var(--color-pink)]"
                : "hover:bg-[var(--color-surface-2)]"
            }`}
          >
            {item.icon}
          </button>
        ))}
        <button
          onClick={() => void logout()}
          title="Cerrar sesión"
          className="mt-auto w-11 h-11 rounded-xl flex items-center justify-center text-xl hover:bg-[var(--color-surface-2)] text-[var(--color-red)]"
        >
          ⎋
        </button>
      </nav>

      {/* Columna contextual */}
      {column && (
        <aside className="w-80 shrink-0 bg-[var(--color-surface)] border-r border-[var(--color-border)] overflow-hidden">
          {column}
        </aside>
      )}

      {/* Panel principal */}
      <main className="flex-1 min-w-0 bg-[var(--color-bg)]">{renderPanel()}</main>
    </div>
  );
}

import { useState } from "react";
import { AuthProvider, useAuth } from "./auth/AuthContext.tsx";
import { Register } from "./pages/Register.tsx";
import { VerifyEmail } from "./pages/VerifyEmail.tsx";
import { Login } from "./pages/Login.tsx";
import { ForgotPassword } from "./pages/ForgotPassword.tsx";
import { ResetPassword } from "./pages/ResetPassword.tsx";
import { Profile } from "./pages/Profile.tsx";
import { EditProfile } from "./pages/EditProfile.tsx";
import { Friends } from "./pages/Friends.tsx";
import { ChatView } from "./pages/ChatView.tsx";
import { Card, Button } from "./components/ui.tsx";

type View = "login" | "register" | "verify" | "forgot" | "reset";
type HomeView = "home" | "profile" | "edit" | "friends" | "chat";

function Home() {
  const { user, logout } = useAuth();
  const [view, setView] = useState<HomeView>("home");
  const [chatWith, setChatWith] = useState("");

  if (view === "profile" && user) {
    return <Profile nickname={user.nickname} onBack={() => setView("home")} />;
  }
  if (view === "edit") {
    return <EditProfile onBack={() => setView("home")} />;
  }
  if (view === "friends") {
    return (
      <Friends
        onBack={() => setView("home")}
        onOpenChat={(nickname) => { setChatWith(nickname); setView("chat"); }}
      />
    );
  }
  if (view === "chat") {
    return <ChatView withNickname={chatWith} onBack={() => setView("friends")} />;
  }

  return (
    <Card>
      <h1 className="text-2xl font-bold text-[var(--color-green)]">¡Hola, {user?.nickname}!</h1>
      <p className="mt-2 mb-6 text-[var(--color-comment)]">Sesión iniciada en Cross-Games.</p>
      <div className="flex flex-col gap-3">
        <Button onClick={() => setView("profile")}>Ver mi perfil</Button>
        <Button onClick={() => setView("edit")}>Editar perfil</Button>
        <Button onClick={() => setView("friends")}>Amigos</Button>
        <button onClick={() => void logout()} className="w-full text-sm text-[var(--color-comment)] hover:underline">
          Cerrar sesión
        </button>
      </div>
    </Card>
  );
}

function Gate() {
  const { user, loading } = useAuth();
  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");

  if (loading) {
    return (
      <Card>
        <p className="text-[var(--color-comment)]">Cargando…</p>
      </Card>
    );
  }

  if (user) return <Home />;

  if (view === "register") {
    return <Register onRegistered={(e) => { setEmail(e); setView("verify"); }} />;
  }
  if (view === "verify") {
    return <VerifyEmail email={email} onVerified={() => setView("login")} />;
  }
  if (view === "forgot") {
    return (
      <ForgotPassword
        onSent={(e) => { setEmail(e); setView("reset"); }}
        onBack={() => setView("login")}
      />
    );
  }
  if (view === "reset") {
    return <ResetPassword email={email} onReset={() => setView("login")} />;
  }
  return (
    <Login
      onGoRegister={() => setView("register")}
      onGoForgot={() => setView("forgot")}
    />
  );
}

export function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

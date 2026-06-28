import { useState } from "react";
import { AuthProvider, useAuth } from "./auth/AuthContext.tsx";
import { Register } from "./pages/Register.tsx";
import { VerifyEmail } from "./pages/VerifyEmail.tsx";
import { Login } from "./pages/Login.tsx";
import { Card, Button } from "./components/ui.tsx";

type View = "login" | "register" | "verify";

function Home() {
  const { user, logout } = useAuth();
  return (
    <Card>
      <h1 className="text-2xl font-bold text-[var(--color-green)]">¡Hola, {user?.nickname}!</h1>
      <p className="mt-2 mb-6 text-[var(--color-comment)]">Sesión iniciada en Cross-Games.</p>
      <Button onClick={() => void logout()}>Cerrar sesión</Button>
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
  return <Login onGoRegister={() => setView("register")} />;
}

export function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}

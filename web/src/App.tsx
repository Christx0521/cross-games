import { useState } from "react";
import { AuthProvider, useAuth } from "./auth/AuthContext.tsx";
import { Register } from "./pages/Register.tsx";
import { Login } from "./pages/Login.tsx";
import { ForgotPassword } from "./pages/ForgotPassword.tsx";
import { ResetPassword } from "./pages/ResetPassword.tsx";
import { AppShell } from "./components/AppShell.tsx";
import { Card } from "./components/ui.tsx";

type View = "login" | "register" | "forgot" | "reset";

function Gate() {
  const { user, loading } = useAuth();
  const [view, setView] = useState<View>("login");
  const [email, setEmail] = useState("");

  if (loading) {
    return (
      <Card>
        <p className="text-[var(--color-muted)]">Cargando…</p>
      </Card>
    );
  }

  if (user) return <AppShell />;

  if (view === "register") {
    return <Register onGoLogin={() => setView("login")} />;
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

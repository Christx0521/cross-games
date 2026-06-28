import { useState } from "react";
import { Register } from "./pages/Register.tsx";
import { VerifyEmail } from "./pages/VerifyEmail.tsx";
import { Card } from "./components/ui.tsx";

type View = "register" | "verify" | "done";

export function App() {
  const [view, setView] = useState<View>("register");
  const [email, setEmail] = useState("");

  if (view === "register") {
    return <Register onRegistered={(e) => { setEmail(e); setView("verify"); }} />;
  }
  if (view === "verify") {
    return <VerifyEmail email={email} onVerified={() => setView("done")} />;
  }
  return (
    <Card>
      <h1 className="text-2xl font-bold text-[var(--color-green)]">¡Cuenta verificada!</h1>
      <p className="mt-2 text-[var(--color-comment)]">Tu cuenta de Cross-Games está lista.</p>
    </Card>
  );
}

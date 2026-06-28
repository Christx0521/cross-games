import { useState, type FormEvent } from "react";
import { api } from "../lib/api.ts";
import { Card, Field, Button, Alert } from "../components/ui.tsx";

export function ForgotPassword({
  onSent,
  onBack,
}: {
  onSent: (email: string) => void;
  onBack: () => void;
}) {
  const [email, setEmail] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post("/auth/forgot-password", { email });
      setInfo("Si la cuenta existe, enviamos un código a tu email.");
      onSent(email);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <h1 className="text-2xl font-bold mb-6 text-[var(--color-pink)]">Recuperar contraseña</h1>
      {info && <Alert kind="success">{info}</Alert>}
      <form onSubmit={submit}>
        <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Button type="submit" disabled={loading}>{loading ? "Enviando…" : "Enviar código"}</Button>
      </form>
      <button onClick={onBack} className="mt-4 w-full text-sm text-[var(--color-purple)] hover:underline">
        Volver a iniciar sesión
      </button>
    </Card>
  );
}

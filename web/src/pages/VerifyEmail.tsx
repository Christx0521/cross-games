import { useState, type FormEvent } from "react";
import { api, ApiError } from "../lib/api.ts";
import { Card, Field, Button, Alert } from "../components/ui.tsx";

const MESSAGES: Record<string, string> = {
  invalid_code: "Código incorrecto.",
  code_expired: "El código expiró. Pide uno nuevo.",
  too_many_attempts: "Demasiados intentos. Pide un código nuevo.",
  user_not_found: "No encontramos esa cuenta.",
  invalid_request: "El código debe tener 7 dígitos.",
};

export function VerifyEmail({ email, onVerified }: { email: string; onVerified: () => void }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);
    try {
      await api.post("/auth/verify-email", { email, code });
      onVerified();
    } catch (err) {
      const c = err instanceof ApiError ? err.code : "error";
      setError(MESSAGES[c] ?? "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setError("");
    await api.post("/auth/resend-code", { email });
    setInfo("Si la cuenta existe, enviamos un nuevo código.");
  }

  return (
    <Card>
      <h1 className="text-2xl font-bold mb-2 text-[var(--color-pink)]">Verifica tu email</h1>
      <p className="mb-6 text-sm text-[var(--color-comment)]">Enviamos un código a {email}.</p>
      {error && <Alert kind="error">{error}</Alert>}
      {info && <Alert kind="success">{info}</Alert>}
      <form onSubmit={submit}>
        <Field
          label="Código de 7 dígitos"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 7))}
          inputMode="numeric"
          required
        />
        <Button type="submit" disabled={loading}>{loading ? "Verificando…" : "Verificar"}</Button>
      </form>
      <button onClick={resend} className="mt-4 w-full text-sm text-[var(--color-purple)] hover:underline">
        Reenviar código
      </button>
    </Card>
  );
}

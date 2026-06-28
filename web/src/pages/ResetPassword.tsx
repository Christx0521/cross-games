import { useState, type FormEvent } from "react";
import { api, ApiError } from "../lib/api.ts";
import { Card, Field, Button, Alert } from "../components/ui.tsx";

const MESSAGES: Record<string, string> = {
  invalid_code: "Código incorrecto.",
  code_expired: "El código expiró. Pide uno nuevo.",
  too_many_attempts: "Demasiados intentos. Pide un código nuevo.",
  invalid_request: "Revisa los datos (código de 7 dígitos, contraseña mín. 8).",
};

export function ResetPassword({
  email,
  onReset,
}: {
  email: string;
  onReset: () => void;
}) {
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/reset-password", { email, code, newPassword });
      onReset();
    } catch (err) {
      const c = err instanceof ApiError ? err.code : "error";
      setError(MESSAGES[c] ?? "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <h1 className="text-2xl font-bold mb-2 text-[var(--color-pink)]">Nueva contraseña</h1>
      <p className="mb-6 text-sm text-[var(--color-comment)]">Enviamos un código a {email}.</p>
      {error && <Alert kind="error">{error}</Alert>}
      <form onSubmit={submit}>
        <Field
          label="Código de 7 dígitos"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 7))}
          inputMode="numeric"
          required
        />
        <Field
          label="Nueva contraseña"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
        />
        <Button type="submit" disabled={loading}>{loading ? "Guardando…" : "Cambiar contraseña"}</Button>
      </form>
    </Card>
  );
}

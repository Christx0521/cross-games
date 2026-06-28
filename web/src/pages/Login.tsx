import { useState, type FormEvent } from "react";
import { ApiError } from "../lib/api.ts";
import { useAuth } from "../auth/AuthContext.tsx";
import { Card, Field, Button, Alert } from "../components/ui.tsx";

const MESSAGES: Record<string, string> = {
  invalid_credentials: "Usuario o contraseña incorrectos.",
  email_not_verified: "Verifica tu email antes de iniciar sesión.",
  invalid_request: "Revisa los datos del formulario.",
};

export function Login({
  onGoRegister,
  onGoForgot,
}: {
  onGoRegister: () => void;
  onGoForgot: () => void;
}) {
  const { login } = useAuth();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(identifier, password);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "error";
      setError(MESSAGES[code] ?? "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <h1 className="text-2xl font-bold mb-6 text-[var(--color-pink)]">Iniciar sesión</h1>
      {error && <Alert kind="error">{error}</Alert>}
      <form onSubmit={submit}>
        <Field
          label="Nickname o email"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
        />
        <Field
          label="Contraseña"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit" disabled={loading}>{loading ? "Entrando…" : "Entrar"}</Button>
      </form>
      <button onClick={onGoRegister} className="mt-4 w-full text-sm text-[var(--color-purple)] hover:underline">
        ¿No tienes cuenta? Regístrate
      </button>
      <button onClick={onGoForgot} className="mt-2 w-full text-sm text-[var(--color-comment)] hover:underline">
        ¿Olvidaste tu contraseña?
      </button>
    </Card>
  );
}

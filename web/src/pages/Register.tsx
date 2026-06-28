import { useState, type FormEvent } from "react";
import { api, ApiError } from "../lib/api.ts";
import { useAuth } from "../auth/AuthContext.tsx";
import { Card, Field, Button, Alert } from "../components/ui.tsx";

const MESSAGES: Record<string, string> = {
  underage: "Debes ser mayor de 18 años.",
  email_taken: "Ese email ya está registrado.",
  nickname_taken: "Ese nickname ya está en uso.",
  invalid_request: "Revisa los datos del formulario.",
};

export function Register({ onGoLogin }: { onGoLogin: () => void }) {
  const { login } = useAuth();
  const [nickname, setNickname] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await api.post("/auth/register", {
        nickname,
        email,
        password,
        birthYear: Number(birthYear),
      });
      // Sin verificación por email: entramos directo tras crear la cuenta.
      await login(email, password);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : "error";
      setError(MESSAGES[code] ?? "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <h1 className="text-2xl font-bold mb-6 text-[var(--color-pink)]">Crear cuenta</h1>
      {error && <Alert kind="error">{error}</Alert>}
      <form onSubmit={submit}>
        <Field label="Nickname" value={nickname} onChange={(e) => setNickname(e.target.value)} required />
        <Field label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <Field label="Contraseña" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        <Field label="Año de nacimiento" type="number" value={birthYear} onChange={(e) => setBirthYear(e.target.value)} required />
        <Button type="submit" disabled={loading}>{loading ? "Creando…" : "Registrarme"}</Button>
      </form>
      <button onClick={onGoLogin} className="mt-4 w-full text-sm text-[var(--color-purple)] hover:underline">
        ¿Ya tienes cuenta? Inicia sesión
      </button>
    </Card>
  );
}

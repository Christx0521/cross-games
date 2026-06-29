const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

export const API_BASE = BASE;

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.code = code;
    this.status = status;
  }
}

export const api = {
  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new ApiError(res.status, String(data.code ?? "error"), data.message as string);
    }
    return data as T;
  },

  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      method: "GET",
      credentials: "include",
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new ApiError(res.status, String(data.code ?? "error"), data.message as string);
    }
    return data as T;
  },

  async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new ApiError(res.status, String(data.code ?? "error"), data.message as string);
    }
    return data as T;
  },

  async del<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      method: "DELETE",
      credentials: "include",
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new ApiError(res.status, String(data.code ?? "error"), data.message as string);
    }
    return data as T;
  },

  async upload<T>(path: string, form: FormData): Promise<T> {
    const res = await fetch(`${BASE}${path}`, {
      method: "POST",
      credentials: "include",
      body: form,
    });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      throw new ApiError(res.status, String(data.code ?? "error"), data.message as string);
    }
    return data as T;
  },
};

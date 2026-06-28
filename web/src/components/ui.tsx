import type { ReactNode, InputHTMLAttributes, ButtonHTMLAttributes } from "react";

export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="max-w-md mx-auto mt-16 p-8 rounded-2xl bg-[var(--color-surface)] shadow-2xl">
      {children}
    </div>
  );
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
}

export function Field({ label, ...props }: FieldProps) {
  return (
    <label className="block mb-4">
      <span className="block mb-1 text-sm text-[var(--color-comment)]">{label}</span>
      <input
        className="w-full px-3 py-2 rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] outline-none focus:ring-2 focus:ring-[var(--color-purple)]"
        {...props}
      />
    </label>
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
}

export function Button({ children, ...props }: ButtonProps) {
  return (
    <button
      className="w-full py-2 rounded-lg font-semibold bg-[var(--color-pink)] text-[var(--color-bg)] hover:bg-[var(--color-magenta)] transition-colors disabled:opacity-50"
      {...props}
    >
      {children}
    </button>
  );
}

export function Alert({ kind, children }: { kind: "error" | "success"; children: ReactNode }) {
  const color = kind === "error" ? "var(--color-red)" : "var(--color-green)";
  return (
    <div className="mb-4 px-3 py-2 rounded-lg text-sm font-medium" style={{ background: color, color: "var(--color-bg)" }}>
      {children}
    </div>
  );
}

// Barra de votos ↑↓ reutilizable para hilos y comentarios.
// `value` es el voto propio (-1, 0, 1); al hacer clic en una flecha activa
// se envía 0 (quitar), si no el valor de esa flecha.
export function VoteBar({
  score,
  value,
  onVote,
  horizontal = false,
}: {
  score: number;
  value: number;
  onVote: (next: number) => void;
  horizontal?: boolean;
}) {
  const up = value === 1 ? "var(--color-pink)" : "var(--color-muted)";
  const down = value === -1 ? "var(--color-purple)" : "var(--color-muted)";
  return (
    <div className={`flex ${horizontal ? "flex-row" : "flex-col"} items-center gap-0.5 select-none`}>
      <button
        onClick={() => onVote(value === 1 ? 0 : 1)}
        className="leading-none text-base hover:scale-110 transition-transform"
        style={{ color: up }}
        title="Votar arriba"
      >
        ▲
      </button>
      <span className="text-xs font-bold text-[var(--color-text)] min-w-5 text-center">{score}</span>
      <button
        onClick={() => onVote(value === -1 ? 0 : -1)}
        className="leading-none text-base hover:scale-110 transition-transform"
        style={{ color: down }}
        title="Votar abajo"
      >
        ▼
      </button>
    </div>
  );
}

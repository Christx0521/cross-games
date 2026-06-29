// Logo de Cross-Games: control de videojuego en rojo neón.
// El brillo neón se logra con capas de drop-shadow sobre el trazo rojo.
const NEON_RED = "#ff1f3d";

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={NEON_RED}
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      role="img"
      aria-label="Cross-Games"
      style={{ filter: `drop-shadow(0 0 2px ${NEON_RED}) drop-shadow(0 0 6px ${NEON_RED}) drop-shadow(0 0 12px ${NEON_RED})` }}
    >
      {/* Cruceta */}
      <line x1="6" y1="11" x2="10" y2="11" />
      <line x1="8" y1="9" x2="8" y2="13" />
      {/* Botones */}
      <line x1="15" y1="12" x2="15.01" y2="12" />
      <line x1="18" y1="10" x2="18.01" y2="10" />
      {/* Cuerpo del control */}
      <path d="M17.32 5H6.68a4 4 0 0 0-3.978 3.59c-.006.052-.01.101-.017.152C2.604 9.416 2 14.456 2 16a3 3 0 0 0 3 3c1 0 1.5-.5 2-1l1.414-1.414A2 2 0 0 1 9.828 16h4.344a2 2 0 0 1 1.414.586L17 18c.5.5 1 1 2 1a3 3 0 0 0 3-3c0-1.545-.604-6.584-.685-7.258A4 4 0 0 0 17.32 5z" />
    </svg>
  );
}

// Cursor de paginación keyset sobre la secuencia monotónica `seq` del mensaje.
export function encodeCursor(seq: number): string {
  return Buffer.from(String(seq), "utf8").toString("base64url");
}

export function decodeCursor(raw: string): number | null {
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const seq = Number(decoded);
    return Number.isInteger(seq) && seq > 0 ? seq : null;
  } catch {
    return null;
  }
}

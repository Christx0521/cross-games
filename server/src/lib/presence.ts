// Presencia en memoria: cuenta conexiones de socket activas por usuario.
// online = al menos una conexión. Devuelve transiciones para emitir eventos.
export function createPresence() {
  const connections = new Map<string, number>();

  return {
    // Suma una conexión. Devuelve true si el usuario pasó de offline a online.
    connect(userId: string): boolean {
      const n = connections.get(userId) ?? 0;
      connections.set(userId, n + 1);
      return n === 0;
    },

    // Resta una conexión. Devuelve true si el usuario pasó a offline.
    disconnect(userId: string): boolean {
      const n = connections.get(userId) ?? 0;
      if (n <= 1) {
        connections.delete(userId);
        return n === 1;
      }
      connections.set(userId, n - 1);
      return false;
    },

    isOnline(userId: string): boolean {
      return (connections.get(userId) ?? 0) > 0;
    },

    onlineAmong(userIds: string[]): string[] {
      return userIds.filter((id) => this.isOnline(id));
    },
  };
}

export type Presence = ReturnType<typeof createPresence>;

import type { FriendsRepo, FriendSummary, FriendRequest } from "./repo.ts";
import { AppError } from "../../lib/errors.ts";

export type Notify = (userId: string, event: string, payload: unknown) => void;

export interface RequestResult {
  status: "pending" | "accepted";
  friendshipId: string;
}

export function createFriendsService(deps: {
  repo: FriendsRepo;
  notify?: Notify;
  isBlocked?: (a: string, b: string) => Promise<boolean>;
}) {
  const { repo } = deps;
  const notify: Notify = deps.notify ?? (() => {});
  const isBlocked = deps.isBlocked ?? (async () => false);

  return {
    async requestFriend(
      requester: { id: string; nickname: string },
      nickname: string
    ): Promise<RequestResult> {
      const target = await repo.findUserByNickname(nickname);
      if (!target) throw new AppError(404, "user_not_found");
      if (target.id === requester.id) throw new AppError(400, "cannot_add_self");
      if (await isBlocked(requester.id, target.id)) throw new AppError(403, "blocked");

      const rel = await repo.findRelationship(requester.id, target.id);
      if (rel) {
        if (rel.status === "accepted") throw new AppError(409, "already_friends");
        // pending
        if (rel.requester_id === requester.id) throw new AppError(409, "already_requested");
        // El otro ya me había solicitado: auto-aceptar.
        await repo.accept(rel.id);
        notify(rel.requester_id, "friend:accepted", { by: requester.nickname });
        return { status: "accepted", friendshipId: rel.id };
      }

      const created = await repo.createRequest(requester.id, target.id);
      notify(target.id, "friend:request", { from: requester.nickname });
      return { status: "pending", friendshipId: created.id };
    },

    async accept(userId: string, friendshipId: string): Promise<void> {
      const rel = await repo.getById(friendshipId);
      if (!rel) throw new AppError(404, "request_not_found");
      if (rel.addressee_id !== userId) throw new AppError(403, "forbidden");
      if (rel.status !== "pending") throw new AppError(409, "not_pending");
      await repo.accept(rel.id);
      notify(rel.requester_id, "friend:accepted", { friendshipId: rel.id });
    },

    async reject(userId: string, friendshipId: string): Promise<void> {
      const rel = await repo.getById(friendshipId);
      if (!rel) throw new AppError(404, "request_not_found");
      if (rel.addressee_id !== userId) throw new AppError(403, "forbidden");
      await repo.deleteById(rel.id);
    },

    listFriends(userId: string): Promise<FriendSummary[]> {
      return repo.listFriends(userId);
    },

    listRequests(userId: string): Promise<FriendRequest[]> {
      return repo.listRequests(userId);
    },
  };
}

export type FriendsService = ReturnType<typeof createFriendsService>;

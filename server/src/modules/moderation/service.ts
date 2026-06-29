import type { ModerationRepo, BlockedUser } from "./repo.ts";
import { AppError } from "../../lib/errors.ts";

const TARGET_TYPES = ["user", "post", "thread", "comment", "message"];
const MAX_REASON = 500;

// Interfaz que consumen chat/feed/amigos para respetar los bloqueos.
export interface BlockGuard {
  isBlocked(a: string, b: string): Promise<boolean>;
  blockedIds(userId: string): Promise<string[]>;
}

export function createModerationService(deps: { repo: ModerationRepo }): BlockGuard & {
  block(blockerId: string, nickname: string): Promise<void>;
  unblock(blockerId: string, blockedId: string): Promise<void>;
  listBlocked(blockerId: string): Promise<BlockedUser[]>;
  report(reporterId: string, input: { targetType: string; targetId: string; reason?: string }): Promise<{ id: string }>;
} {
  const { repo } = deps;

  return {
    async block(blockerId: string, nickname: string): Promise<void> {
      const target = await repo.findUserByNickname(nickname);
      if (!target) throw new AppError(404, "user_not_found");
      if (target.id === blockerId) throw new AppError(400, "cannot_block_self");
      await repo.block(blockerId, target.id);
    },

    async unblock(blockerId: string, blockedId: string): Promise<void> {
      await repo.unblock(blockerId, blockedId);
    },

    listBlocked(blockerId: string): Promise<BlockedUser[]> {
      return repo.listBlocked(blockerId);
    },

    isBlocked(a: string, b: string): Promise<boolean> {
      return repo.isBlockedEitherWay(a, b);
    },

    blockedIds(userId: string): Promise<string[]> {
      return repo.relatedBlockedIds(userId);
    },

    async report(reporterId: string, input: { targetType: string; targetId: string; reason?: string }): Promise<{ id: string }> {
      if (!TARGET_TYPES.includes(input.targetType)) throw new AppError(422, "invalid_target_type");
      const reason = (input.reason ?? "").trim().slice(0, MAX_REASON);
      const id = await repo.createReport({
        reporterId,
        targetType: input.targetType,
        targetId: input.targetId,
        reason,
      });
      return { id };
    },
  };
}

export type ModerationService = ReturnType<typeof createModerationService>;

import type { GroupsRepo, GroupSummary } from "./repo.ts";
import type { Notify } from "../friends/service.ts";
import { AppError } from "../../lib/errors.ts";

const MAX_MEMBERS = 20;

export function createGroupsService(deps: { repo: GroupsRepo; notify?: Notify }) {
  const { repo } = deps;
  const notify: Notify = deps.notify ?? (() => {});

  async function ensureAdmin(groupId: string, userId: string): Promise<void> {
    const conv = await repo.getConversation(groupId);
    if (!conv || conv.type !== "group") throw new AppError(404, "group_not_found");
    const role = await repo.getMemberRole(groupId, userId);
    if (role !== "admin") throw new AppError(403, "not_admin");
  }

  return {
    async createGroup(userId: string, name: string): Promise<{ id: string; name: string }> {
      return repo.createGroup(name.trim(), userId);
    },

    async addMember(adminId: string, groupId: string, nickname: string): Promise<void> {
      await ensureAdmin(groupId, adminId);
      const target = await repo.findUserByNickname(nickname);
      if (!target) throw new AppError(404, "user_not_found");
      if (await repo.getMemberRole(groupId, target.id)) throw new AppError(409, "already_member");
      const added = await repo.addMemberIfRoom(groupId, target.id, MAX_MEMBERS);
      if (!added) throw new AppError(409, "group_full");
      notify(target.id, "group:added", { groupId });
    },

    async removeMember(adminId: string, groupId: string, userId: string): Promise<void> {
      await ensureAdmin(groupId, adminId);
      if (userId === adminId) throw new AppError(400, "cannot_remove_self");
      await repo.removeMember(groupId, userId);
      notify(userId, "group:removed", { groupId });
    },

    listGroups(userId: string): Promise<GroupSummary[]> {
      return repo.listGroups(userId);
    },
  };
}

export type GroupsService = ReturnType<typeof createGroupsService>;

import { type Database, eq } from "@nemu/db";
import { user } from "@nemu/db/schema/auth";

import type { NemuProfileRecord } from "./nemu-data-source";

export type NemuProfileRepository = {
  findById(userId: string): Promise<NemuProfileRecord | undefined>;
};

export function createNemuProfileRepository(db: Database): NemuProfileRepository {
  return {
    async findById(userId) {
      const [profile] = await db
        .select({
          id: user.id,
          name: user.name,
          golongan: user.golongan,
          unit: user.unit,
          province: user.province,
        })
        .from(user)
        .where(eq(user.id, userId))
        .limit(1);
      return profile;
    },
  };
}

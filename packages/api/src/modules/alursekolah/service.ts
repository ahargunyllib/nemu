import type { AlurSekolahConnection } from "@nemu/contracts/integrations";

import { MissingSecretKeyError } from "../integrations/cipher";
import { type AlurSekolahClient, AlurSekolahError } from "./client";
import { type AlurSekolahConnector, AlurSekolahNotConfiguredError } from "./connector";

/** WS-07 "Cek koneksi": whose key this is and how many grades it can read through `/nilai`. */
export async function checkConnection(
  connect: AlurSekolahConnector,
  workspaceId: string,
): Promise<AlurSekolahConnection> {
  let client: AlurSekolahClient;
  try {
    client = await connect(workspaceId);
  } catch (error) {
    if (error instanceof AlurSekolahNotConfiguredError || error instanceof MissingSecretKeyError) {
      return { status: "failed", message: error.message };
    }
    throw error;
  }
  try {
    const [guru, nilai] = await Promise.all([
      client.guruSaya(),
      client.nilai({ halaman: 1, ukuran: 1 }),
    ]);
    return {
      status: "ok",
      account: guru.data.nama,
      email: guru.data.email,
      classes: guru.data.kelas,
      grades: nilai.meta.total,
    };
  } catch (error) {
    if (error instanceof AlurSekolahError) return { status: "failed", message: error.message };
    throw error;
  }
}

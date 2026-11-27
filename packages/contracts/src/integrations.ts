import { z } from "zod";

/** WS-07 settings. Every value is encrypted at rest; none is ever sent back to a client. */
export const integrationSecretNameSchema = z.enum([
  "alursekolah_base_url",
  "alursekolah_api_key",
  "moodle_url",
  "moodle_token",
  "whatsapp_number",
]);
export type IntegrationSecretName = z.infer<typeof integrationSecretNameSchema>;

/** What the Admin Workspace may know about a setting: whether it is set, and its last 4 characters. */
export const integrationSecretStatusSchema = z
  .object({
    name: integrationSecretNameSchema,
    lastFour: z.string().nullable(),
    updatedAt: z.date().nullable(),
  })
  .strict();
export type IntegrationSecretStatus = z.infer<typeof integrationSecretStatusSchema>;

export const saveIntegrationSecretInputSchema = z
  .object({ name: integrationSecretNameSchema, value: z.string().trim().min(1).max(2000) })
  .strict();

/** "Cek koneksi": the AlurSekolah account behind the key, and how many grades it can read. */
export const alurSekolahConnectionSchema = z.discriminatedUnion("status", [
  z.object({
    status: z.literal("ok"),
    account: z.string(),
    email: z.string(),
    classes: z.array(z.string()),
    grades: z.number(),
  }),
  z.object({ status: z.literal("failed"), message: z.string() }),
]);
export type AlurSekolahConnection = z.infer<typeof alurSekolahConnectionSchema>;

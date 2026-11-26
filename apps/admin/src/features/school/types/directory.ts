import type { client } from "@/shared/api/orpc";

export type Teacher = Awaited<ReturnType<typeof client.listTeachers>>[number];
export type Contact = Awaited<ReturnType<typeof client.listContacts>>[number];

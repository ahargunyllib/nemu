import { ORPCError } from "@orpc/server";
import { z } from "zod";

import type { Context } from "../../context";
import { fullAdminProcedure, schoolAdminProcedure } from "../../index";
import { createSchoolRepository } from "./repository";
import {
  createTeacher,
  deleteContact,
  deleteTeacher,
  listContacts,
  listTeachers,
  saveContact,
  type TeacherWriteResult,
  updateTeacher,
} from "./service";

function schoolDeps(context: Pick<Context, "db">) {
  return { school: createSchoolRepository(context.db) };
}

const honorificSchema = z.enum(["Bu", "Pak"]);
const contactRoleSchema = z.enum(["operator", "kepsek", "keuangan"]);
// A local (08…) or international (+62 …) number; spaces and dashes are dropped on save.
const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[\d\s-]{9,20}$/u, "Nomor WhatsApp tidak valid");

const teacherInputSchema = z.object({
  name: z.string().trim().min(1).max(120),
  honorific: honorificSchema,
  nip: z.string().trim().max(30).optional(),
  email: z.email().max(200),
  phone: phoneSchema,
  classes: z.array(z.string().trim().min(1).max(20)).min(1).max(20),
  subjects: z.array(z.string().trim().min(1).max(60)).min(1).max(30),
});

function throwUnlessSaved(result: TeacherWriteResult) {
  if (result === "not_found") throw new ORPCError("NOT_FOUND", { message: "Guru tidak ditemukan" });
  if (result === "email_taken") {
    throw new ORPCError("CONFLICT", { message: "Email AlurSekolah ini sudah dipakai guru lain" });
  }
  if (result === "phone_taken") {
    throw new ORPCError("CONFLICT", { message: "Nomor WhatsApp ini sudah dipakai guru lain" });
  }
}

/** WS-01 (school list, Admin Javan only) and WS-06 (teachers and contacts, operator or admin). */
export const schoolRouter = {
  listSchools: fullAdminProcedure.handler(({ context }) =>
    createSchoolRepository(context.db).listSchools(),
  ),

  listTeachers: schoolAdminProcedure.handler(({ context }) =>
    listTeachers(schoolDeps(context), context.session.user.workspaceId),
  ),

  createTeacher: schoolAdminProcedure
    .input(teacherInputSchema)
    .handler(async ({ context, input }) => {
      throwUnlessSaved(
        await createTeacher(schoolDeps(context), context.session.user.workspaceId, input),
      );
    }),

  updateTeacher: schoolAdminProcedure
    .input(teacherInputSchema.extend({ id: z.string().min(1) }))
    .handler(async ({ context, input: { id, ...input } }) => {
      throwUnlessSaved(
        await updateTeacher(schoolDeps(context), context.session.user.workspaceId, id, input),
      );
    }),

  deleteTeacher: schoolAdminProcedure
    .input(z.object({ id: z.string().min(1) }))
    .handler(async ({ context, input }) => {
      const result = await deleteTeacher(
        schoolDeps(context),
        context.session.user.workspaceId,
        input.id,
      );
      throwUnlessSaved(result);
    }),

  listContacts: schoolAdminProcedure.handler(({ context }) =>
    listContacts(schoolDeps(context), context.session.user.workspaceId),
  ),

  saveContact: schoolAdminProcedure
    .input(
      z.object({
        role: contactRoleSchema,
        name: z.string().trim().min(1).max(120),
        honorific: honorificSchema,
        phone: phoneSchema,
      }),
    )
    .handler(({ context, input }) =>
      saveContact(schoolDeps(context), context.session.user.workspaceId, input),
    ),

  deleteContact: schoolAdminProcedure
    .input(z.object({ role: contactRoleSchema }))
    .handler(async ({ context, input }) => {
      const result = await deleteContact(
        schoolDeps(context),
        context.session.user.workspaceId,
        input.role,
      );
      if (result === "not_found") {
        throw new ORPCError("NOT_FOUND", { message: "Kontak tidak ditemukan" });
      }
    }),
};

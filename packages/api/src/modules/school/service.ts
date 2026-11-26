import type { Contact } from "@nemu/contracts/school";
import type { TeacherProfile } from "@nemu/ai/school/profile";

import { normalizePhone } from "./directory";
import type { ContactRecord, ContactRole, SchoolRepository, TeacherRecord } from "./repository";

export type Honorific = "Bu" | "Pak";

export type TeacherInput = {
  name: string;
  honorific: Honorific;
  nip?: string;
  email: string;
  phone: string;
  classes: string[];
  subjects: string[];
};

export type ContactInput = { role: ContactRole; name: string; honorific: Honorific; phone: string };

export type TeacherWriteResult = "ok" | "not_found" | "email_taken" | "phone_taken";

type Deps = { school: SchoolRepository };

function cleanList(values: string[], transform: (value: string) => string = (value) => value) {
  return [...new Set(values.map((value) => transform(value.trim())).filter(Boolean))];
}

function normalizeTeacher(input: TeacherInput) {
  return {
    name: input.name.trim(),
    honorific: input.honorific,
    nip: input.nip?.trim() ?? "",
    email: input.email.trim().toLowerCase(),
    phone: normalizePhone(input.phone),
    classes: cleanList(input.classes, (value) => value.toUpperCase()),
    subjects: cleanList(input.subjects),
  };
}

/** The email and the WhatsApp number each identify one teacher (#199, #203), so neither may repeat. */
async function findConflict(
  deps: Deps,
  teacher: { email: string; phone: string },
  ownId?: string,
): Promise<"email_taken" | "phone_taken" | null> {
  const [byEmail, byPhone] = await Promise.all([
    deps.school.findTeacher({ email: teacher.email }),
    deps.school.findTeacher({ phone: teacher.phone }),
  ]);
  if (byEmail && byEmail.id !== ownId) return "email_taken";
  if (byPhone && byPhone.id !== ownId) return "phone_taken";
  return null;
}

export function listTeachers(deps: Deps, workspaceId: string): Promise<TeacherRecord[]> {
  return deps.school.listTeachers(workspaceId);
}

export async function createTeacher(
  deps: Deps,
  workspaceId: string,
  input: TeacherInput,
): Promise<TeacherWriteResult> {
  const teacher = normalizeTeacher(input);
  const conflict = await findConflict(deps, teacher);
  if (conflict) return conflict;
  await deps.school.insertTeacher({ id: crypto.randomUUID(), workspaceId, ...teacher });
  return "ok";
}

export async function updateTeacher(
  deps: Deps,
  workspaceId: string,
  id: string,
  input: TeacherInput,
): Promise<TeacherWriteResult> {
  const teacher = normalizeTeacher(input);
  const conflict = await findConflict(deps, teacher, id);
  if (conflict) return conflict;
  return (await deps.school.updateTeacher(workspaceId, id, teacher)) ? "ok" : "not_found";
}

export async function deleteTeacher(deps: Deps, workspaceId: string, id: string) {
  return (await deps.school.deleteTeacher(workspaceId, id)) ? "ok" : "not_found";
}

const CONTACT_ORDER: readonly ContactRole[] = ["operator", "kepsek", "keuangan"];

/** The school's contacts in the order WS-06 lists them: operator, kepala sekolah, bagian keuangan. */
export async function listContacts(deps: Deps, workspaceId: string): Promise<ContactRecord[]> {
  const contacts = await deps.school.listContacts(workspaceId);
  return contacts.toSorted((a, b) => CONTACT_ORDER.indexOf(a.role) - CONTACT_ORDER.indexOf(b.role));
}

export function saveContact(deps: Deps, workspaceId: string, input: ContactInput) {
  return deps.school.upsertContact({
    workspaceId,
    role: input.role,
    name: input.name.trim(),
    honorific: input.honorific,
    phone: normalizePhone(input.phone),
  });
}

export async function deleteContact(deps: Deps, workspaceId: string, role: ContactRole) {
  return (await deps.school.deleteContact(workspaceId, role)) ? "ok" : "not_found";
}

/** How a teacher hears the contact named: "Pak Rizal" for Rizal Pratama. */
export function contactCallName(contact: Pick<ContactRecord, "name" | "honorific">): string {
  const firstName = contact.name.trim().split(/[\s,]+/u)[0] ?? contact.name;
  return `${contact.honorific} ${firstName}`;
}

/** A WS-06 teacher as the school AI reads it (L-02), with the school's contacts by role. */
export function toTeacherProfile(
  teacher: TeacherRecord,
  contacts: readonly ContactRecord[],
  schoolName: string,
): TeacherProfile {
  return {
    teacherId: teacher.id,
    name: teacher.name,
    honorific: teacher.honorific,
    nip: teacher.nip,
    phone: teacher.phone,
    schoolName,
    classes: teacher.classes,
    subjects: teacher.subjects,
    contacts: Object.fromEntries(
      contacts.map((contact): [string, Contact] => [
        contact.role,
        { name: contactCallName(contact), role: contact.role, phone: contact.phone },
      ]),
    ),
  };
}

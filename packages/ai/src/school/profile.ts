import type { Contact } from "@nemu/contracts/school";

import type { RosterStudent } from "./names.js";

/** What Nemu knows about the signed-in teacher (L-02). The fullstack side supplies it. */
export type TeacherProfile = {
  teacherId: string;
  name: string;
  /** How Nemu addresses the teacher: "Bu" or "Pak". */
  honorific: "Bu" | "Pak";
  /** Added to WhatsApp drafts by code; never sent to a model. */
  nip: string;
  /** The teacher's registered WhatsApp number (E.164 without "+"); photos from it are theirs (F1-01). */
  phone: string;
  schoolName: string;
  classes: string[];
  subjects: string[];
  /** Who can fix what, by role key used in the kamus kendala: "kepsek", "operator", … */
  contacts: Record<string, Contact>;
};

export type ClassRoster = { className: string; students: RosterStudent[] };

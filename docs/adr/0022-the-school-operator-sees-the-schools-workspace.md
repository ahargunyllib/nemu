# The school operator sees the school's whole Workspace, and Admin Javan keeps the keys

The Admin Workspace has two roles. Admin Javan (`admin`) sees every page and every school. The school operator (`operator`, Pak Rizal) used to see only the school's knowledge (WS-04, WS-05, WS-09) and Teachers & contacts (WS-06). The Workspace design shows Pak Rizal's own menu with Ringkasan, the knowledge pages, Guru dan kontak, Website diizinkan, Integrasi and Log aktivitas, and the product owner chose (28 Nov 2026) to open those pages to operators.

Each page gives the operator what the design shows them doing, and the server enforces it, not just the menu:

| Page                            | Operator                                    | Admin Javan only                    |
| ------------------------------- | ------------------------------------------- | ----------------------------------- |
| Ringkasan (`/dashboard`)        | reads it, uploads a document                | —                                   |
| Website diizinkan (WS-03)       | lists, adds, changes and removes websites   | —                                   |
| Pengaturan Nemu (WS-08)         | reads the settings (`getSchoolSettings`)    | changes them (`saveSchoolSettings`) |
| Integrasi (WS-07)               | sees the masked list: set or not, last four | enters keys, "Cek koneksi"          |
| Log aktivitas (WS-10)           | reads it                                    | — (nothing on it can be changed)    |
| Daftar sekolah, package, Tables | —                                           | everything                          |

WS-03 is the operator's because the design gives Pak Rizal "+ Tambah website" and the list says which school websites Nemu works on, which the school knows best (ADR-0016). WS-07 stays Admin Javan's to fill, as its card says ("Diisi Admin Javan · kunci disimpan terenkripsi di server"): the school hands the keys to Javan, and no procedure ever returns a stored value (ADR-0014), so the operator sees the same "terpasang · …last four" an admin does and nothing more. "Cek koneksi" stays with the admin who entered the key, because it is how they check it. WS-08 changes how Nemu behaves for every teacher, so only Admin Javan changes it; the operator only reads it.

In code, operator-and-admin procedures use `schoolAdminProcedure` or `workspaceAdminProcedure`, and Admin Javan-only ones `fullAdminProcedure` or `schoolFullAdminProcedure`. The Admin Workspace's `adminOnly` menu flag hides a page from the operator and its route guard sends them to Ringkasan; a teacher (`guru`) still gets FORBIDDEN everywhere.

Partial: `getSchoolSettings` is open to the operator, but no operator page shows the settings yet. The Website diizinkan page shows them once it carries the design's "Pengaturan Nemu" card; until then the `/settings` page stays Admin Javan's.

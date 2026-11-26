# Mock AlurSekolah

The AlurSekolah stand-in the Nemu Extension runs on until the school's test tenant exists. It is a
port of Richard's `05_tiruan-alursekolah/index.html` (Isi nilai kelas, Rekap Nilai, Al-Quran ›
Tahfidz, Profil) with the same element ids, labels, Indonesian copy and accounts. The extension and
the test cases rely on them, so don't rename them.

All data is synthetic (SDIT Nusantara). Students come from `01_profil-sekolah/` (4A, 4B, 5A).

## Accounts

Password for every account: `nemu-uji-2026`.

| Username         | Email                                   | Role     | Assignments                                                    |
| ---------------- | --------------------------------------- | -------- | -------------------------------------------------------------- |
| `siti.aminah`    | `siti.aminah@sdit-nusantara.example`    | guru     | 4A: Bahasa Inggris, Tahfidz · 4B: Matematika, Bahasa Indonesia |
| `dewi.lestari`   | `dewi.lestari@sdit-nusantara.example`   | guru     | 5A: Bahasa Indonesia                                           |
| `rizal.operator` | `rizal.operator@sdit-nusantara.example` | operator | all classes                                                    |

IPAS 4A is deliberately not assigned to Bu Siti: Nilai › 4A › IPAS › Tampilkan Siswa shows
"Anda belum ditugaskan mengampu IPAS di kelas 4A" (test F2-2). The signed-in email is on Profil
(`#profil-email`) and in the menu (`#menu-email`), where the extension reads it.

## How it works

One Cloudflare Worker (`src/worker.ts`):

- `public/index.html` is the page, served as static assets.
- `/_mock/*` is what the page calls: school data, the sign-in check, and saving grades and
  tahfidz records. Saves go to the mock's own D1 database (`migrations/`), so every browser sees
  the same data. localStorage only remembers who is signed in.
- `/api/v1/*` is a read-only slice of AlurSekolah API v1, shaped like
  `https://business.alursekolah.id/api/v1/openapi.json`: `GET /nilai`, `/nilai/rekap`, `/siswa`,
  `/kelas`, `/akademik/guru/saya` and `/hafalan/setoran`. Every call needs
  `Authorization: Bearer <key>`, where the key is the Worker secret `MOCK_ALURSEKOLAH_API_KEY`
  (default `as_uji_sdit_nusantara_2026`). The key behaves like an admin key, so every class is in
  scope.

Mock-specific choices: KKM is 75 (the test data's value, not the Javan demo's 80); a subject's final
grade is the plain mean of its assessments; empty grade cells are kept for the page but left out of
`/nilai`; 4B and 5A only have NISN, so it is used as `nis`.

The mock's data is a separate fake system and never touches the Nemu Service's D1 schema.

## Run and deploy

`pnpm dev` starts it with the rest of the stack at <http://localhost:3003> (Ruang GTK at 3004,
e-Rapor at 3005). Production: `nemu-alursekolah.ahargunyllib.dev`, deployed by
`packages/infra/alchemy.run.ts`. `pnpm --filter mock-alursekolah test` runs its tests.

The government-portal mocks are static pages in `apps/mock-portals/`: Ruang GTK
(`nemu-ruang-gtk.ahargunyllib.dev`, the F2-3 error with a "Sinkro Ruang GTK" button under
E-Kinerja) and e-Rapor (`nemu-erapor.ahargunyllib.dev`, the WS-1 page on a site that is not on the
allowed list).

-- The Nemu Extension for SDIT Nusantara (W-SEKOLAH): the install code the school operator types
-- into the extension's settings (ADR-0014), and the WS-03 allowed websites (ADR-0015). The code is
-- synthetic and documented in apps/extension/README.md. e-Rapor is left off on purpose: WS-1 (a)
-- expects no Nemu button there.
--> statement-breakpoint
INSERT INTO `school_install_code` (`code`, `workspace_id`) VALUES
  ('NEMU-SDITN-2026', 'W-SEKOLAH');
--> statement-breakpoint
INSERT INTO `allowed_site` (`id`, `workspace_id`, `pattern`, `label`) VALUES
  ('sekolah-alursekolah', 'W-SEKOLAH', '*.alursekolah.id', 'AlurSekolah'),
  ('sekolah-mock-alursekolah', 'W-SEKOLAH', 'nemu-alursekolah.ahargunyllib.dev', 'AlurSekolah (tiruan)'),
  ('sekolah-mock-alursekolah-local', 'W-SEKOLAH', 'localhost:3003', 'AlurSekolah (tiruan, lokal)'),
  ('sekolah-mock-ruang-gtk', 'W-SEKOLAH', 'nemu-ruang-gtk.ahargunyllib.dev', 'Ruang GTK (tiruan)'),
  ('sekolah-mock-ruang-gtk-local', 'W-SEKOLAH', 'localhost:3004', 'Ruang GTK (tiruan, lokal)'),
  ('sekolah-moodle', 'W-SEKOLAH', 'nemu-moodle.ahargunyllib.dev', 'Moodle (uji)');

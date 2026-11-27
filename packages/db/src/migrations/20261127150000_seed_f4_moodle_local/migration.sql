-- F4 (#209): the Moodle test site run locally from infra/ (https://localhost), next to the VPS one,
-- so the extension's F4 checks can be developed and verified before the VPS is up. Both Moodle
-- rows read and fill: F4-1 only reads and points, and #210 puts a quiz into Moodle.
--> statement-breakpoint
INSERT INTO `allowed_site` (`id`, `workspace_id`, `pattern`, `label`) VALUES
  ('sekolah-moodle-local', 'W-SEKOLAH', 'localhost:443', 'Moodle (uji, lokal)');

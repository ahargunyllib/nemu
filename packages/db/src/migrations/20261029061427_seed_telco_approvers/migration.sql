-- The W-TELKO approvers on MP-BILL-02's route above Rp500.000, so a Klaim SLA can go through
-- Persetujuan to Credit Note (issue #146). Their user ids match `telco_user`. Passwords are
-- documented in docs/demo-app.md; hashes come from better-auth's hashPassword (scrypt, "salt:key" hex).
INSERT INTO `user` (`id`, `name`, `email`, `email_verified`, `golongan`, `unit`, `province`, `role`, `workspace_id`) VALUES
  ('U-102', 'Sari Wulandari', 'sari@nemu.demo', 1, '–', 'Billing Operations', 'DKI Jakarta', 'supervisor_billing', 'W-TELKO'),
  ('U-103', 'Hendra Gunawan', 'hendra@nemu.demo', 1, '–', 'Billing Operations', 'DKI Jakarta', 'manajer_billing_operations', 'W-TELKO');
--> statement-breakpoint
INSERT INTO `account` (`id`, `account_id`, `provider_id`, `user_id`, `password`, `updated_at`) VALUES
  ('sari-credential', 'U-102', 'credential', 'U-102', '950e1536b215bf5a9feed8b403a942b0:d3e47910fb4a3f25ceb325da1a56ae092746a3687a04fb923a1d56b8214776de13c7dfcd12cc36c2839e3679818b2d39229fb475f8d11534854480023b42e119', cast(unixepoch('subsecond') * 1000 as integer)),
  ('hendra-credential', 'U-103', 'credential', 'U-103', 'e2f19358638b7cc7183e9eee7dfbbd45:ae492336fb75d679b4215e71db371b8499e2fb737d222f68b621dd60802ba25ac155108e92951938b3182a00647ee76c01395de5ea6c26bbaf01127ce19418c8', cast(unixepoch('subsecond') * 1000 as integer));

-- Demo accounts for the Demo App (issue #2). Passwords are documented in docs/demo-app.md.
-- Hashes come from better-auth's hashPassword (scrypt, "salt:key" hex).
INSERT INTO `user` (`id`, `name`, `email`, `email_verified`, `golongan`, `role`) VALUES
	('rina', 'Rina Pratiwi', 'rina@nemu.demo', true, 'III/a', 'pegawai'),
	('verifikator', 'Dimas Saputra', 'verifikator@nemu.demo', true, 'III/c', 'verifikator');
--> statement-breakpoint
INSERT INTO `account` (`id`, `account_id`, `provider_id`, `user_id`, `password`, `updated_at`) VALUES
	('rina-credential', 'rina', 'credential', 'rina', '606b2f0c326b9e5fb421bc2c50d22ac1:145d4709f8d24f7109e3e6dc50100c1fe79ce20128556130ea1e364ed828c4672ab7d42c23b30a70ce68f76db99a87f9fea0a6490b39687a7b7392dcf83f4d3e', cast(unixepoch('subsecond') * 1000 as integer)),
	('verifikator-credential', 'verifikator', 'credential', 'verifikator', '6a1727298dabfca3fd6a0653c3b0e6bf:e81af297a088367a85649fa31c25675da97dc29b62cdcc028eba07c544c41f550b411cda3983a489a2ed6a7ee8e5d2e2a4f85bbd41d6a2b51c4642bcf2b64aed', cast(unixepoch('subsecond') * 1000 as integer));

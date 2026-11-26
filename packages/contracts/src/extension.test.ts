import assert from "node:assert/strict";
import { test } from "node:test";

import { hostPermissionFor, isAllowedUrl, siteMatches } from "./extension.js";

test("a wildcard site covers the tenant subdomains and the apex, not look-alikes", () => {
  assert.ok(siteMatches("*.alursekolah.id", "https://sditnusantara.alursekolah.id/nilai"));
  assert.ok(siteMatches("*.alursekolah.id", "https://alursekolah.id/"));
  assert.ok(!siteMatches("*.alursekolah.id", "https://alursekolah.id.evil.example/"));
  assert.ok(!siteMatches("*.alursekolah.id", "https://notalursekolah.id/"));
});

test("an exact host matches only itself, and a port pins the port", () => {
  assert.ok(
    siteMatches(
      "nemu-alursekolah.ahargunyllib.dev",
      "https://nemu-alursekolah.ahargunyllib.dev/#/",
    ),
  );
  assert.ok(
    !siteMatches("nemu-alursekolah.ahargunyllib.dev", "https://nemu-erapor.ahargunyllib.dev/"),
  );
  assert.ok(siteMatches("localhost:3003", "http://localhost:3003/#/nilai"));
  assert.ok(!siteMatches("localhost:3003", "http://localhost:3005/"));
});

test("WS-1 (a): e-Rapor is off a list that holds the mocks, and browser pages never match", () => {
  const sites = [
    { pattern: "*.alursekolah.id", label: "AlurSekolah" },
    { pattern: "nemu-alursekolah.ahargunyllib.dev", label: "AlurSekolah (tiruan)" },
    { pattern: "nemu-ruang-gtk.ahargunyllib.dev", label: "Ruang GTK (tiruan)" },
  ];
  assert.ok(!isAllowedUrl(sites, "https://nemu-erapor.ahargunyllib.dev/"));
  assert.ok(isAllowedUrl(sites, "https://nemu-ruang-gtk.ahargunyllib.dev/kinerja"));
  assert.ok(!isAllowedUrl(sites, "chrome://extensions"));
  assert.ok(!isAllowedUrl(sites, undefined));
});

test("the host permission for a site uses http only for localhost and drops the port", () => {
  assert.equal(hostPermissionFor("*.alursekolah.id"), "https://*.alursekolah.id/*");
  assert.equal(hostPermissionFor("portal.sekolah.sch.id"), "https://portal.sekolah.sch.id/*");
  assert.equal(hostPermissionFor("localhost:3003"), "http://localhost/*");
});

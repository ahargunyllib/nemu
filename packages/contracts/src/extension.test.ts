import assert from "node:assert/strict";
import { test } from "node:test";

import {
  hostPermissionFor,
  isAllowedUrl,
  mayFill,
  siteMatches,
  sitePermissionFor,
} from "./extension.js";

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

test("WS-03: the narrower permission wins where two sites cover a page", () => {
  const sites = [
    { pattern: "*.alursekolah.id", label: "AlurSekolah", permission: "read_fill" as const },
    { pattern: "rapor.alursekolah.id", label: "Rapor", permission: "read_only" as const },
    { pattern: "web.whatsapp.com", label: "WhatsApp", permission: "prepare_message" as const },
  ];
  assert.equal(sitePermissionFor(sites, "https://sditn.alursekolah.id/nilai"), "read_fill");
  assert.equal(sitePermissionFor(sites, "https://rapor.alursekolah.id/"), "read_only");
  assert.equal(sitePermissionFor(sites, "https://web.whatsapp.com/"), "prepare_message");
  assert.equal(sitePermissionFor(sites, "https://nemu-erapor.ahargunyllib.dev/"), null);
  assert.ok(mayFill("read_fill"));
  assert.ok(!mayFill("read_only"));
  assert.ok(!mayFill("prepare_message"));
});

test("a list cached before WS-03 had permissions still reads and fills", () => {
  assert.equal(
    sitePermissionFor([{ pattern: "localhost:3003" }], "http://localhost:3003/#/nilai"),
    "read_fill",
  );
});

import type { PageEmail } from "../../../shared/lib/messages";

/**
 * Reads the signed-in account's email from one kind of site (ADR-0015). Each AlurSekolah deployment
 * marks up its account area differently, so each gets its own reader.
 */
export type PageEmailReader = {
  name: string;
  covers(url: URL): boolean;
  /** The signed-in email, or null when the page shows no signed-in account. */
  read(document: Document): string | null;
};

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/u;

function emailIn(text: string | null | undefined): string | null {
  return text?.match(EMAIL)?.[0]?.toLowerCase() ?? null;
}

/**
 * The mock AlurSekolah (`apps/mock-alursekolah`): the menu (`#menu-email`) and Profil
 * (`#profil-email`) show the signed-in email, and the menu is hidden while signed out.
 */
export const mockAlurSekolahReader: PageEmailReader = {
  name: "mock-alursekolah",
  covers: (url) =>
    url.hostname === "nemu-alursekolah.ahargunyllib.dev" ||
    (url.hostname === "localhost" && url.port === "3003"),
  read(document) {
    const menu = document.getElementById("nav");
    if (!menu || menu.classList.contains("hidden")) return null;
    return (
      emailIn(document.getElementById("menu-email")?.textContent) ??
      emailIn(document.getElementById("profil-email")?.textContent)
    );
  },
};

/**
 * PLACEHOLDER, waiting on the tenant's page HTML (#199): Javan's AlurSekolah tenant on
 * `*.alursekolah.id`. Until its header or profile markup is known, this takes the first email
 * shown in the page's header, menu or account area. Replace it with the tenant's own selectors.
 */
export const alurSekolahTenantReader: PageEmailReader = {
  name: "alursekolah-tenant (placeholder)",
  covers: (url) => url.hostname === "alursekolah.id" || url.hostname.endsWith(".alursekolah.id"),
  read(document) {
    const areas = document.querySelectorAll(
      "header, nav, [class*='profile' i], [class*='account' i], [class*='user' i], [class*='akun' i]",
    );
    for (const area of areas) {
      const email = emailIn(area.textContent);
      if (email) return email;
    }
    return null;
  },
};

const READERS: readonly PageEmailReader[] = [mockAlurSekolahReader, alurSekolahTenantReader];

/** The email this page shows, or `unreadable` on a site with no reader (Ruang GTK, Moodle). */
export function readPageEmail(url: string, document: Document): PageEmail {
  if (!URL.canParse(url)) return { kind: "unreadable" };
  const page = new URL(url);
  const reader = READERS.find((candidate) => candidate.covers(page));
  return reader ? { kind: "read", email: reader.read(document) } : { kind: "unreadable" };
}

export function samePageEmail(left: PageEmail, right: PageEmail): boolean {
  if (left.kind === "unreadable" || right.kind === "unreadable") return left.kind === right.kind;
  return left.email === right.email;
}

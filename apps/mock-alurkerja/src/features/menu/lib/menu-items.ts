import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { linkOptions } from "@tanstack/react-router";

type MenuItem = {
  label: string;
  /** A page of the Demo App, or none for AlurKerja menus the demo does not open. */
  link?: { to: "/" | "/my-task" | "/my-request"; nemuId: string };
  /** `tasks` counts the signed-in user's Tasks; a number is a static demo count. */
  badge?: "tasks" | number;
  /** AlurKerja opens a submenu here, so the item ends in a chevron. */
  submenu?: boolean;
};

export const MENU_ITEMS: readonly MenuItem[] = [
  { label: "Beranda", link: { to: "/", nemuId: NEMU_IDS.shell.menuBeranda } },
  {
    label: "Tugas Saya",
    link: { to: "/my-task", nemuId: NEMU_IDS.shell.menuMyTask },
    badge: "tasks",
  },
  { label: "Tugas Grup", badge: 2 },
  {
    label: "Pengajuan Saya",
    link: { to: "/my-request", nemuId: NEMU_IDS.shell.menuMyRequest },
    submenu: true,
  },
  { label: "Analitik", submenu: true },
  { label: "Data Master", submenu: true },
  { label: "Proses Bisnis", submenu: true },
];

/** The records of a claim that CRM Layanan, Tiket NOC, and Billing open. */
type ClaimRecords = { id: string; serviceId: string; invoiceId: string };

/**
 * The claim the telco menus open records for: the one the page shows (its task, service, or
 * invoice), else the first claim.
 */
export function claimInFocus<Claim extends ClaimRecords>(
  claims: readonly Claim[],
  pathname: string,
): Claim | undefined {
  const [, section, rawId] = pathname.split("/");
  const id = rawId && decodeURIComponent(rawId);
  return (
    claims.find(
      (claim) =>
        (section === "sla-claims" && claim.id === id) ||
        ((section === "crm" || section === "noc") && claim.serviceId === id) ||
        (section === "billing" && claim.invoiceId === id),
    ) ?? claims[0]
  );
}

/**
 * The W-TELKO side menu. CRM Layanan, Tiket NOC, and Billing open the records of `claim`; without
 * one (still loading, or no claims) they have no link.
 */
export function telcoMenuItems(claim: ClaimRecords | undefined) {
  return [
    {
      label: "Beranda",
      section: "/",
      nemuId: NEMU_IDS.shell.menuBeranda,
      link: linkOptions({ to: "/" }),
    },
    {
      label: "Klaim SLA",
      section: "/sla-claims",
      nemuId: NEMU_IDS.shell.menuSlaClaims,
      link: linkOptions({ to: "/sla-claims" }),
    },
    {
      label: "CRM Layanan",
      section: "/crm",
      nemuId: NEMU_IDS.shell.menuCrmServices,
      link: claim && linkOptions({ to: "/crm/$serviceId", params: { serviceId: claim.serviceId } }),
    },
    {
      label: "Tiket NOC",
      section: "/noc",
      nemuId: NEMU_IDS.shell.menuNocTickets,
      link: claim && linkOptions({ to: "/noc/$serviceId", params: { serviceId: claim.serviceId } }),
    },
    {
      label: "Billing",
      section: "/billing",
      nemuId: NEMU_IDS.shell.menuBilling,
      link:
        claim && linkOptions({ to: "/billing/$invoiceId", params: { invoiceId: claim.invoiceId } }),
    },
  ];
}

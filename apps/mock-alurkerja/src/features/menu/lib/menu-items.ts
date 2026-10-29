import { NEMU_IDS } from "@nemu/contracts/nemu-ids";

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
  { label: "Home", link: { to: "/", nemuId: NEMU_IDS.shell.menuBeranda } },
  {
    label: "My Tasks",
    link: { to: "/my-task", nemuId: NEMU_IDS.shell.menuMyTask },
    badge: "tasks",
  },
  { label: "Group Tasks", badge: 2 },
  {
    label: "My Requests",
    link: { to: "/my-request", nemuId: NEMU_IDS.shell.menuMyRequest },
    submenu: true,
  },
  { label: "Analytics", submenu: true },
  { label: "Master Data", submenu: true },
  { label: "Business Processes", submenu: true },
];

export const TELCO_MENU_ITEMS = [
  { href: "/", label: "Home", nemuId: NEMU_IDS.shell.menuBeranda },
  { href: "/sla-claims", label: "Klaim SLA", nemuId: NEMU_IDS.shell.menuSlaClaims },
  { href: "/crm/TN-ENT-002", label: "CRM Layanan", nemuId: NEMU_IDS.shell.menuCrmServices },
  { href: "/noc/TN-ENT-002", label: "Tiket NOC", nemuId: NEMU_IDS.shell.menuNocTickets },
  { href: "/billing/INV-2609-0042", label: "Billing", nemuId: NEMU_IDS.shell.menuBilling },
] as const;

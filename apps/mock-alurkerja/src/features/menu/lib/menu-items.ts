import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import {
  ClipboardList,
  Database,
  FileClock,
  FilePlus2,
  House,
  ListTodo,
  Network,
  ReceiptText,
} from "lucide-react";

export const MENU_ITEMS = [
  { to: "/", label: "Beranda", icon: House, nemuId: NEMU_IDS.shell.menuBeranda },
  {
    to: "/perdin/baru",
    label: "Ajukan Perjalanan Dinas",
    icon: FilePlus2,
    nemuId: NEMU_IDS.shell.menuAjukanPerjalananDinas,
  },
  {
    to: "/my-request",
    label: "My Request",
    icon: ClipboardList,
    nemuId: NEMU_IDS.shell.menuMyRequest,
  },
  { to: "/my-task", label: "My Task", icon: ListTodo, nemuId: NEMU_IDS.shell.menuMyTask },
] as const;

export const TELCO_MENU_ITEMS = [
  { href: "/", label: "Beranda", icon: House, nemuId: NEMU_IDS.shell.menuBeranda },
  {
    href: "/sla-claims",
    label: "Klaim SLA",
    icon: FileClock,
    nemuId: NEMU_IDS.shell.menuSlaClaims,
  },
  {
    href: "/crm/TN-ENT-002",
    label: "CRM Layanan",
    icon: Database,
    nemuId: NEMU_IDS.shell.menuCrmServices,
  },
  {
    href: "/noc/TN-ENT-002",
    label: "Tiket NOC",
    icon: Network,
    nemuId: NEMU_IDS.shell.menuNocTickets,
  },
  {
    href: "/billing/INV-2609-0042",
    label: "Billing",
    icon: ReceiptText,
    nemuId: NEMU_IDS.shell.menuBilling,
  },
] as const;

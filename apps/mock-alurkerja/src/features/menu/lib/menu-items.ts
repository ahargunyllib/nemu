import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import { ClipboardList, FilePlus2, House, ListTodo } from "lucide-react";

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

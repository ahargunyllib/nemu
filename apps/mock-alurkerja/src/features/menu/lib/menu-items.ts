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

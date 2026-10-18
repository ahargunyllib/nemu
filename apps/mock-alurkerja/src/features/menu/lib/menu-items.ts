import { NEMU_IDS } from "@nemu/contracts/nemu-ids";
import {
  ChartColumn,
  ClipboardList,
  Database,
  House,
  ListTodo,
  type LucideIcon,
  Users,
  Workflow,
} from "lucide-react";

type MenuItem = {
  label: string;
  icon: LucideIcon;
  /** A page of the Demo App, or none for AlurKerja menus the demo does not open. */
  link?: { to: "/" | "/my-task" | "/my-request"; nemuId: string };
  /** `tasks` counts the signed-in user's Tasks; a number is a static demo count. */
  badge?: "tasks" | number;
};

export const MENU_ITEMS: readonly MenuItem[] = [
  { label: "Home", icon: House, link: { to: "/", nemuId: NEMU_IDS.shell.menuBeranda } },
  {
    label: "My Tasks",
    icon: ListTodo,
    link: { to: "/my-task", nemuId: NEMU_IDS.shell.menuMyTask },
    badge: "tasks",
  },
  { label: "Group Tasks", icon: Users, badge: 2 },
  {
    label: "My Requests",
    icon: ClipboardList,
    link: { to: "/my-request", nemuId: NEMU_IDS.shell.menuMyRequest },
  },
  { label: "Analytics", icon: ChartColumn },
  { label: "Master Data", icon: Database },
  { label: "Business Processes", icon: Workflow },
];

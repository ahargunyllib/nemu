import {
  FileTextIcon,
  GlobeIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  MessagesSquareIcon,
  ShieldCheckIcon,
  TableIcon,
  UsersIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  icon: LucideIcon;
} & (
  | { to: "/dashboard" | "/chat-log" | "/documents" | "/tables"; comingSoon?: never }
  | { to?: never; comingSoon: true }
);

export type NavGroup = {
  label: string;
  items: NavItem[];
};

// Sections the Admin Workspace will manage; ones without a page yet show as "Soon".
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
      { to: "/chat-log", label: "Chat Log", icon: MessagesSquareIcon },
    ],
  },
  {
    label: "Knowledge",
    items: [
      { to: "/documents", label: "Documents", icon: FileTextIcon },
      { to: "/tables", label: "Tables", icon: TableIcon },
    ],
  },
  {
    label: "Configuration",
    items: [
      { label: "Domains", icon: GlobeIcon, comingSoon: true },
      { label: "Action Rules", icon: ShieldCheckIcon, comingSoon: true },
      { label: "User Profiles", icon: UsersIcon, comingSoon: true },
    ],
  },
];

export function findNavLocation(pathname: string) {
  for (const group of NAV_GROUPS) {
    const item = group.items.find((candidate) => candidate.to && pathname.startsWith(candidate.to));
    if (item) return { group: group.label, item: item.label };
  }
  return null;
}

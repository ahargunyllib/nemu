import {
  FileTextIcon,
  GlobeIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  SchoolIcon,
  ShieldCheckIcon,
  TableIcon,
  UsersIcon,
} from "lucide-react";

import { isFullAdmin } from "@/features/workspace/lib/roles";

type NavPath = "/dashboard" | "/documents" | "/tables" | "/schools" | "/teachers" | "/integrations";

export type NavItem = {
  label: string;
  icon: LucideIcon;
  /** Only Admin Javan sees it; a school operator doesn't. */
  adminOnly?: boolean;
} & ({ to: NavPath; comingSoon?: never } | { to?: never; comingSoon: true });

export type NavGroup = {
  label: string;
  items: NavItem[];
};

// Sections the Admin Workspace will manage; ones without a page yet show as "Soon".
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [{ to: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon, adminOnly: true }],
  },
  {
    label: "Sekolah",
    items: [
      { to: "/schools", label: "Daftar sekolah", icon: SchoolIcon, adminOnly: true },
      { to: "/teachers", label: "Guru & kontak", icon: UsersIcon },
    ],
  },
  {
    label: "Knowledge",
    items: [
      { to: "/documents", label: "Documents", icon: FileTextIcon },
      { to: "/tables", label: "Tables", icon: TableIcon, adminOnly: true },
    ],
  },
  {
    label: "Configuration",
    items: [
      { to: "/integrations", label: "Integrasi", icon: KeyRoundIcon, adminOnly: true },
      { label: "Domains", icon: GlobeIcon, comingSoon: true, adminOnly: true },
      { label: "Action Rules", icon: ShieldCheckIcon, comingSoon: true, adminOnly: true },
    ],
  },
];

/** The menu a role sees: Admin Javan everything, an operator only its school's pages. */
export function navGroupsFor(role: string | null | undefined): NavGroup[] {
  if (isFullAdmin(role)) return NAV_GROUPS;
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => !item.adminOnly),
  })).filter((group) => group.items.length > 0);
}

/** Whether a role may open the page at `pathname`; pages outside the menu are left to the server. */
export function canOpen(role: string | null | undefined, pathname: string): boolean {
  const item = NAV_GROUPS.flatMap((group) => group.items).find(
    (candidate) => candidate.to && pathname.startsWith(candidate.to),
  );
  return !item?.adminOnly || isFullAdmin(role);
}

export function findNavLocation(pathname: string) {
  for (const group of NAV_GROUPS) {
    const item = group.items.find((candidate) => candidate.to && pathname.startsWith(candidate.to));
    if (item) return { group: group.label, item: item.label };
  }
  return null;
}

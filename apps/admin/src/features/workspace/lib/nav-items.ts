import {
  BookOpenIcon,
  FileTextIcon,
  FlaskConicalIcon,
  GlobeIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  type LucideIcon,
  PackageIcon,
  SchoolIcon,
  SlidersHorizontalIcon,
  TableIcon,
  UsersIcon,
} from "lucide-react";

import { isFullAdmin } from "@/features/workspace/lib/roles";

type NavPath =
  | "/dashboard"
  | "/documents"
  | "/package"
  | "/kamus"
  | "/try-answer"
  | "/tables"
  | "/schools"
  | "/teachers"
  | "/sites"
  | "/settings"
  | "/integrations"
  | "/action-log";

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
    label: "Pengetahuan",
    items: [
      { to: "/package", label: "Paket AlurSekolah", icon: PackageIcon, adminOnly: true },
      { to: "/documents", label: "Pengetahuan sekolah", icon: FileTextIcon },
      { to: "/kamus", label: "Kamus Kendala", icon: BookOpenIcon },
      { to: "/try-answer", label: "Uji jawaban", icon: FlaskConicalIcon },
      { to: "/tables", label: "Tables", icon: TableIcon, adminOnly: true },
    ],
  },
  {
    label: "Pengaturan",
    items: [
      { to: "/sites", label: "Situs yang diizinkan", icon: GlobeIcon, adminOnly: true },
      { to: "/settings", label: "Pengaturan Nemu", icon: SlidersHorizontalIcon, adminOnly: true },
      { to: "/integrations", label: "Integrasi", icon: KeyRoundIcon, adminOnly: true },
      { to: "/action-log", label: "Log tindakan", icon: ListChecksIcon, adminOnly: true },
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

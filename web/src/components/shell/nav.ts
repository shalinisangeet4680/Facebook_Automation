import {
  BarChart3,
  Inbox,
  LayoutGrid,
  ListChecks,
  type LucideIcon,
  Megaphone,
  Settings,
  Sparkles,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  soon?: boolean;
}

export const NAV: NavItem[] = [
  { href: "/setup", label: "Setup", icon: ListChecks },
  { href: "/claude", label: "Claude", icon: Sparkles },
  { href: "/inbox", label: "Inbox", icon: Inbox, soon: true },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/creatives", label: "Creatives", icon: LayoutGrid },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function sectionFor(pathname: string): NavItem | undefined {
  return NAV.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

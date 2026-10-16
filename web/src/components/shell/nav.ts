import {
  BarChart3,
  Inbox,
  LayoutGrid,
  ListChecks,
  type LucideIcon,
  Megaphone,
  MessageSquareReply,
  Settings,
  Smartphone,
  Sparkles,
  Store,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  soon?: boolean;
  group?: "Meta ads" | "Google Play";
  badge?: "reviews";
}

export const NAV: NavItem[] = [
  { href: "/setup", label: "Setup", icon: ListChecks },
  { href: "/claude", label: "Claude", icon: Sparkles },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone, group: "Meta ads" },
  { href: "/creatives", label: "Creatives", icon: LayoutGrid, group: "Meta ads" },
  { href: "/profile", label: "Page & Instagram", icon: Store, group: "Meta ads" },
  { href: "/reports", label: "Reports", icon: BarChart3, group: "Meta ads" },
  { href: "/store", label: "Store listing", icon: Smartphone, group: "Google Play" },
  {
    href: "/reviews",
    label: "Review replies",
    icon: MessageSquareReply,
    group: "Google Play",
    badge: "reviews",
  },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function sectionFor(pathname: string): NavItem | undefined {
  return NAV.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

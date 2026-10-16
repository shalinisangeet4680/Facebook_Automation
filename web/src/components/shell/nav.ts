import {
  BarChart3,
  Building2,
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
  group?: "Meta ads" | "Google Play" | "Google Business";
  badge?: "reviews";
}

export const NAV: NavItem[] = [
  { href: "/claude", label: "Claude", icon: Sparkles },
  { href: "/setup", label: "Setup", icon: ListChecks, group: "Meta ads" },
  { href: "/inbox", label: "Inbox", icon: Inbox, group: "Meta ads" },
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
  {
    href: "/business",
    label: "Business Profile",
    icon: Building2,
    group: "Google Business",
  },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function sectionFor(pathname: string): NavItem | undefined {
  return NAV.find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));
}

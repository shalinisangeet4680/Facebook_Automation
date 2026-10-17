"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { useMe } from "@/lib/api/queries";
import { ProductShell } from "@/features/replyly/shell";
import { cx } from "@/features/replyly/ui";

const NAV = [
  ["Products", "/home"],
  ["Use with Claude", "/claude"],
] as const;

function NavLinks({ mobile }: { mobile?: boolean }) {
  const pathname = usePathname();
  return (
    <>
      {NAV.map(([label, href]) => (
        <Link
          key={href}
          href={href}
          aria-current={pathname === href ? "page" : undefined}
          className={cx("rp-nav", pathname === href && "rp-nav-on")}
          style={mobile ? { flexShrink: 0 } : undefined}
        >
          <span>{label}</span>
        </Link>
      ))}
    </>
  );
}

function Footer() {
  const me = useMe();
  return (
    <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 2 }}>
      <div
        style={{
          padding: 10,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          borderTop: "1px solid #E6E4DF",
          marginTop: 8,
        }}
      >
        <span style={{ fontSize: 12.5, fontWeight: 500 }}>
          {me.data?.workspace.name ?? "Workspace"}
        </span>
        <span style={{ fontSize: 11.5, color: "#6C6962", textTransform: "capitalize" }}>
          {me.data?.workspace.role ?? ""}
        </span>
      </div>
    </div>
  );
}

export function WorkspaceShell({
  children,
  fontClass,
}: {
  children: ReactNode;
  fontClass: string;
}) {
  return (
    <ProductShell fontClass={fontClass} product="Workspace" Nav={NavLinks} Footer={Footer}>
      {children}
    </ProductShell>
  );
}

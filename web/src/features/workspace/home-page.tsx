"use client";

import Link from "next/link";

import { CATALOG } from "@/features/products/catalog";
import { PageHead } from "@/features/replyly/ui";

export function HomePage() {
  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 28 }}>
      <PageHead
        title="Your products"
        sub="Every TreeVook product shares this workspace, its AI and its Settings."
      />
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
          gap: 14,
        }}
      >
        {CATALOG.map((p) => {
          const Icon = p.features[0]!.icon;
          return (
            <Link
              key={p.id}
              href={p.appHref}
              className="rp-card rp-row"
              style={{
                padding: 20,
                display: "flex",
                flexDirection: "column",
                gap: 14,
                color: "inherit",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    background: p.soft,
                    color: p.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={19} />
                </span>
                <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 15 }}>{p.name}</span>
                  <span style={{ fontSize: 12, color: "#6C6962" }}>{p.worksWith}</span>
                </span>
              </span>
              <span style={{ fontSize: 13, color: "#55534E", lineHeight: 1.5, flex: 1 }}>
                {p.sub}
              </span>
              <span style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {p.features.slice(0, 3).map((f) => (
                  <span
                    key={f.title}
                    style={{
                      padding: "3px 9px",
                      borderRadius: 999,
                      background: "#F1EFEA",
                      fontSize: 11.5,
                      color: "#55534E",
                    }}
                  >
                    {f.title}
                  </span>
                ))}
              </span>
              <span style={{ fontSize: 13, fontWeight: 500, color: p.color }}>Open →</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

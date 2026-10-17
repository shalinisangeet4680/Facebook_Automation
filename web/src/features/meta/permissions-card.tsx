import type { Permission } from "@/lib/api/types";

import { CardTitle, CopyButton, MUTED, Pill, cardHead } from "./ui";

export function PermissionsCard({ permissions }: { permissions: Permission[] }) {
  const needed = permissions.filter((p) => p.level !== "optional");
  return (
    <div className="rp-card" style={{ overflow: "hidden" }}>
      <div style={cardHead}>
        <CardTitle title="Permissions to tick" sub="Select these when you generate the token." />
        <CopyButton value={needed.map((p) => p.name).join(", ")} label="Copy all" />
      </div>
      <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {needed.map((p, i) => (
          <li
            key={p.name}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
              padding: "11px 18px",
              borderTop: i ? "1px solid #EFEDE8" : "none",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 0 }}>
              <span
                className="rp-mono"
                style={{ fontSize: 12.5, fontWeight: 500, overflowWrap: "anywhere" }}
              >
                {p.name}
              </span>
              <span style={{ fontSize: 12, color: MUTED }}>{p.purpose}</span>
            </div>
            <Pill tone={p.level === "required" ? "success" : "neutral"}>
              {p.level === "required" ? "Required" : "Recommended"}
            </Pill>
          </li>
        ))}
      </ul>
    </div>
  );
}

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import type { Permission } from "@/lib/api/types";

export function PermissionsCard({ permissions }: { permissions: Permission[] }) {
  const needed = permissions.filter((p) => p.level !== "optional");
  return (
    <Card>
      <div className="border-border flex items-center justify-between gap-3 border-b px-5 py-4">
        <div>
          <h3 className="text-[15px] font-semibold">Permissions to tick</h3>
          <p className="text-small text-muted">Select these when you generate the token.</p>
        </div>
        <CopyButton value={needed.map((p) => p.name).join(", ")} label="Copy all" />
      </div>
      <ul className="divide-border divide-y">
        {needed.map((p) => (
          <li key={p.name} className="flex items-start gap-3 px-5 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-small text-foreground font-mono font-medium">{p.name}</p>
              <p className="text-caption text-muted">{p.purpose}</p>
            </div>
            <Badge tone={p.level === "required" ? "accent" : "neutral"}>
              {p.level === "required" ? "Required" : "Recommended"}
            </Badge>
          </li>
        ))}
      </ul>
    </Card>
  );
}

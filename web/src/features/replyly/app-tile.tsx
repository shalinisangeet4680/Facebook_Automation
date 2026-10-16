import Image from "next/image";

import type { PlayApp } from "@/lib/api/types";

export function AppTile({
  app,
  color,
  size,
  radius,
  font,
}: {
  app: Pick<PlayApp, "title" | "iconUrl">;
  color: string;
  size: number;
  radius: number;
  font: number;
}) {
  return (
    <span
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        borderRadius: radius,
        background: color,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontWeight: 600,
        fontSize: font,
        overflow: "hidden",
      }}
    >
      {app.iconUrl ? (
        <Image
          unoptimized
          src={app.iconUrl}
          alt=""
          width={size}
          height={size}
          style={{ objectFit: "cover" }}
        />
      ) : (
        (app.title.trim()[0] ?? "?").toUpperCase()
      )}
    </span>
  );
}

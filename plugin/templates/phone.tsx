import React from "react";
import { Img, staticFile } from "remotion";
import { useStorePalette } from "./brand";
import { MONT } from "./theme";
import { StatusBarSpec } from "./types";

const StatusBar: React.FC<{ spec: StatusBarSpec; k: number }> = ({
  spec,
  k,
}) => {
  const { ink } = useStorePalette();
  const c = spec.dark ? "white" : ink;
  return (
    <div
      style={{
        height: 64 * k,
        background: spec.bg,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: `0 ${44 * k}px`,
        fontFamily: MONT,
        fontWeight: 700,
        fontSize: 24 * k,
        color: c,
      }}
    >
      <span>9:41</span>
      <span style={{ display: "flex", gap: 8 * k, alignItems: "center" }}>
        <svg width={30 * k} height={18 * k} viewBox="0 0 30 18">
          {[0, 1, 2, 3].map((i) => (
            <rect
              key={i}
              x={i * 8}
              y={14 - i * 4}
              width="5"
              height={4 + i * 4}
              rx="1.5"
              fill={c}
            />
          ))}
        </svg>
        <svg width={40 * k} height={20 * k} viewBox="0 0 40 20">
          <rect
            x="1"
            y="2"
            width="33"
            height="16"
            rx="4.5"
            fill="none"
            stroke={c}
            strokeWidth="2"
          />
          <rect x="4" y="5" width="27" height="10" rx="2.5" fill={c} />
          <rect x="35.5" y="7" width="3" height="6" rx="1.5" fill={c} />
        </svg>
      </span>
    </div>
  );
};

export const phoneHeight = (
  w: number,
  screenRatio: number,
  statusBar: StatusBarSpec | null,
) => {
  const k = w / 680;
  const bezel = 16 * k;
  const sw = w - bezel * 2;
  return (statusBar ? 64 * k : 0) + sw * screenRatio + bezel * 2;
};

export const Phone: React.FC<{
  w: number;
  screen: string;
  screenRatio: number;
  statusBar: StatusBarSpec | null;
  maxHeight?: number;
  style?: React.CSSProperties;
  shadow?: string;
  ring?: boolean;
}> = ({
  w,
  screen,
  screenRatio,
  statusBar,
  maxHeight,
  style,
  shadow,
  ring,
}) => {
  const { line } = useStorePalette();
  const k = w / 680;
  const bezel = 16 * k;
  const sw = w - bezel * 2;
  const shotH = sw * screenRatio;
  const full = (statusBar ? 64 * k : 0) + shotH;
  const visible = maxHeight ? Math.min(full, maxHeight - bezel * 2) : full;
  return (
    <div
      style={{
        position: "absolute",
        width: w,
        height: visible + bezel * 2,
        borderRadius: 78 * k,
        background: "#06080C",
        boxShadow: [
          shadow ?? "0 60px 140px rgba(0,0,0,0.45)",
          ring ? `0 0 0 ${3 * k}px ${line}` : null,
        ]
          .filter(Boolean)
          .join(", "),
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          left: bezel,
          top: bezel,
          width: sw,
          height: visible,
          borderRadius: 62 * k,
          overflow: "hidden",
          background: "white",
        }}
      >
        {statusBar ? <StatusBar spec={statusBar} k={k} /> : null}
        <Img
          src={staticFile(screen)}
          style={{ display: "block", width: sw, height: shotH }}
        />
      </div>
    </div>
  );
};

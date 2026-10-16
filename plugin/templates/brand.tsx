import React, { createContext, useContext } from "react";
import { Img, staticFile } from "remotion";
import { MONT } from "./theme";
import { Brand, StorePalette } from "./types";

export const DEFAULT_BRAND: Brand = {
  name: "App",
  wordmark: ["App"],
  colors: {
    bg: "#1B2536",
    bg2: "#2A3A55",
    bgDeep: "#141C2A",
    glow: "#6C8EC4",
    accent: "#4CC46A",
    onAccent: "#1B2536",
    text: "#FFFFFF",
    muted: "#DDE6EE",
    danger: "#FF5A5F",
  },
  store: "Google Play",
  logo: null,
};

export const withDefaults = (b?: Partial<Brand>): Brand => ({
  ...DEFAULT_BRAND,
  ...b,
  colors: { ...DEFAULT_BRAND.colors, ...b?.colors },
});

const BrandCtx = createContext<Brand>(DEFAULT_BRAND);
export const BrandProvider = BrandCtx.Provider;
export const useBrand = () => useContext(BrandCtx);

export const Logo: React.FC<{ size: number; shadow?: boolean }> = ({
  size,
  shadow = true,
}) => {
  const b = useBrand();
  const style: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: size * 0.22,
    boxShadow: shadow ? "0 30px 80px rgba(0,0,0,0.45)" : undefined,
  };
  if (b.logo) return <Img src={staticFile(b.logo)} style={style} />;
  return (
    <div
      style={{
        ...style,
        background: b.colors.accent,
        color: b.colors.onAccent,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: MONT,
        fontWeight: 900,
        fontSize: size * 0.56,
      }}
    >
      {b.name.slice(0, 1).toUpperCase()}
    </div>
  );
};

export const Wordmark: React.FC<{ color?: string }> = ({ color }) => {
  const b = useBrand();
  const [head, ...rest] = b.wordmark.length ? b.wordmark : [b.name];
  return (
    <>
      <span style={color ? { color } : undefined}>{head}</span>
      {rest.length ? (
        <span style={{ color: b.colors.accent }}>{rest.join("")}</span>
      ) : null}
    </>
  );
};

export const DEFAULT_STORE_PALETTE: StorePalette = {
  ink: "#202E40",
  bg: "#27374D",
  line: "#526B82",
  muted: "#DDE6ED",
  text: "#FEFEFE",
  deep: "#1A2636",
  mid: "#2A3B52",
};

const PaletteCtx = createContext<StorePalette>(DEFAULT_STORE_PALETTE);
export const PaletteProvider = PaletteCtx.Provider;
export const useStorePalette = () => useContext(PaletteCtx);

export const TONES: Record<string, [string, string]> = {
  blue: ["#E2EAF8", "#2F5BA8"],
  red: ["#FBE3E3", "#C23B3B"],
  teal: ["#DCF2ED", "#1E7F6B"],
  green: ["#E2F3E5", "#2F8A45"],
  amber: ["#FFF0D2", "#9A6200"],
  purple: ["#ECE4FA", "#6A45BE"],
};

export const tone = (name: string): [string, string] =>
  TONES[name] ?? ["#E2EAF8", "#2F5BA8"];

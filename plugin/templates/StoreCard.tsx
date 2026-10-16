import React from "react";
import { AbsoluteFill } from "remotion";
import {
  BrandProvider,
  DEFAULT_STORE_PALETTE,
  Logo,
  PaletteProvider,
  Wordmark,
  tone,
  useBrand,
  useStorePalette,
  withDefaults,
} from "./brand";
import { CalloutsLandscape, CalloutsPortrait } from "./callouts";
import { Phone } from "./phone";
import { MONT } from "./theme";
import {
  Callout,
  CardProps,
  FeatureGraphicProps,
  StoreCardProps,
} from "./types";

const Chips: React.FC<{
  callouts: Callout[];
  k: number;
  max?: number;
  column?: boolean;
}> = ({ callouts, k, max = 3, column }) => (
  <div
    style={{
      display: "flex",
      flexDirection: column ? "column" : "row",
      flexWrap: "wrap",
      gap: 16 * k,
      justifyContent: column ? "flex-start" : "center",
      alignItems: column ? "flex-start" : "center",
    }}
  >
    {callouts.slice(0, max).map((c, i) => {
      const [bg, fg] = tone(c.tone);
      return (
        <div
          key={i}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12 * k,
            padding: `${14 * k}px ${26 * k}px`,
            borderRadius: 999,
            background: bg,
            color: fg,
            fontFamily: MONT,
            fontWeight: 700,
            fontSize: 30 * k,
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              width: 12 * k,
              height: 12 * k,
              borderRadius: "50%",
              background: fg,
            }}
          />
          {c.text.join(" ")}
        </div>
      );
    })}
  </div>
);

const BrandRow: React.FC<{ color: string; plain?: boolean }> = ({
  color,
  plain,
}) => {
  const b = useBrand();
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 18,
        fontFamily: MONT,
        fontWeight: 900,
        fontSize: 44,
        color,
        letterSpacing: -0.5,
      }}
    >
      <Logo size={68} shadow={false} />
      {plain ? (
        <span>{b.name}</span>
      ) : (
        <span>
          <Wordmark />
        </span>
      )}
    </div>
  );
};

const Headline: React.FC<{
  lines: string[];
  size: number;
  color: string;
  mark?: string;
  align?: "left" | "center";
  upper?: boolean;
}> = ({ lines, size, color, mark, align = "left", upper }) => (
  <div
    style={{
      fontFamily: MONT,
      fontWeight: 900,
      fontSize: size,
      lineHeight: 1.08,
      color,
      letterSpacing: -2,
      textAlign: align,
      textTransform: upper ? "uppercase" : undefined,
    }}
  >
    {lines.map((ln, i) => (
      <div key={i}>
        <span
          style={
            mark && i === lines.length - 1
              ? {
                  background: `linear-gradient(180deg, transparent 58%, ${mark} 58%, ${mark} 92%, transparent 92%)`,
                  padding: "0 6px",
                }
              : undefined
          }
        >
          {ln}
        </span>
      </div>
    ))}
  </div>
);

const phoneOf = (card: CardProps) => ({
  screen: card.screen,
  screenRatio: card.screenRatio,
  statusBar: card.statusBar,
});

type StyleProps = { card: CardProps; portrait: boolean };

const Light: React.FC<StyleProps> = ({ card, portrait }) => {
  const { ink, muted } = useStorePalette();
  const accent = useBrand().colors.accent;
  const bg = `linear-gradient(180deg, #FFFFFF 0%, ${muted} 100%)`;
  const shadow = `0 50px 120px ${ink}40`;
  if (portrait)
    return (
      <AbsoluteFill style={{ background: bg, overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 96,
            width: 1080,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 40,
          }}
        >
          <BrandRow color={ink} />
          <Headline
            lines={card.headline}
            size={92}
            color={ink}
            mark={`${accent}66`}
            align="center"
          />
          <div style={{ width: 980 }}>
            <Chips callouts={card.callouts} k={1} />
          </div>
        </div>
        <Phone
          w={700}
          {...phoneOf(card)}
          style={{ left: 190, top: 800 }}
          shadow={shadow}
        />
      </AbsoluteFill>
    );
  return (
    <AbsoluteFill style={{ background: bg, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: 130,
          top: 0,
          height: 1080,
          width: 900,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 44,
        }}
      >
        <BrandRow color={ink} />
        <Headline
          lines={card.headline}
          size={92}
          color={ink}
          mark={`${accent}66`}
        />
        <Chips callouts={card.callouts} k={1} column />
      </div>
      <Phone
        w={540}
        {...phoneOf(card)}
        style={{ left: 1200, top: 110 }}
        shadow={shadow}
      />
    </AbsoluteFill>
  );
};

const Stripes: React.FC<{ color: string }> = ({ color }) => (
  <AbsoluteFill
    style={{
      backgroundImage: `repeating-linear-gradient(135deg, ${color} 0 2px, transparent 2px 46px)`,
      opacity: 0.12,
    }}
  />
);

const Bold: React.FC<StyleProps> = ({ card, portrait }) => {
  const c = useBrand().colors;
  const shadow = "0 70px 160px rgba(0,0,0,0.4)";
  if (portrait)
    return (
      <AbsoluteFill style={{ background: c.accent, overflow: "hidden" }}>
        <Stripes color={c.onAccent} />
        <div
          style={{
            position: "absolute",
            left: 84,
            top: 110,
            width: 920,
            display: "flex",
            flexDirection: "column",
            gap: 44,
          }}
        >
          <BrandRow color={c.onAccent} plain />
          <Headline lines={card.headline} size={112} color={c.onAccent} upper />
          {card.sub ? (
            <div
              style={{
                fontFamily: MONT,
                fontWeight: 600,
                fontSize: 40,
                color: c.onAccent,
                opacity: 0.85,
              }}
            >
              {card.sub}
            </div>
          ) : null}
        </div>
        <Phone
          w={700}
          {...phoneOf(card)}
          style={{ left: 300, top: 820, transform: "rotate(-8deg)" }}
          shadow={shadow}
        />
      </AbsoluteFill>
    );
  return (
    <AbsoluteFill style={{ background: c.accent, overflow: "hidden" }}>
      <Stripes color={c.onAccent} />
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 0,
          height: 1080,
          width: 980,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 44,
        }}
      >
        <BrandRow color={c.onAccent} plain />
        <Headline lines={card.headline} size={104} color={c.onAccent} upper />
      </div>
      <Phone
        w={540}
        {...phoneOf(card)}
        style={{ left: 1260, top: 150, transform: "rotate(-8deg)" }}
        shadow={shadow}
      />
    </AbsoluteFill>
  );
};

const Minimal: React.FC<StyleProps> = ({ card, portrait }) => {
  const { bg, deep, text } = useStorePalette();
  const accent = useBrand().colors.accent;
  const background = `linear-gradient(180deg, ${bg} 0%, ${deep} 100%)`;
  const glow = `radial-gradient(circle, ${accent}44 0%, transparent 65%)`;
  const head = (size: number, align: "left" | "center") => (
    <div
      style={{
        fontFamily: MONT,
        fontWeight: 900,
        fontSize: size,
        lineHeight: 1.08,
        letterSpacing: -2,
        textAlign: align,
        color: text,
      }}
    >
      {card.headline.map((ln, i) => (
        <div
          key={i}
          style={{
            color: i === card.headline.length - 1 ? accent : undefined,
          }}
        >
          {ln}
        </div>
      ))}
    </div>
  );
  if (portrait)
    return (
      <AbsoluteFill style={{ background, overflow: "hidden" }}>
        <div
          style={{
            position: "absolute",
            left: 90,
            top: 140,
            width: 900,
            height: 900,
            borderRadius: "50%",
            background: glow,
          }}
        />
        <Phone
          w={620}
          {...phoneOf(card)}
          maxHeight={1360}
          style={{ left: 230, top: 110 }}
        />
        <div style={{ position: "absolute", left: 60, top: 1500, width: 960 }}>
          {head(86, "center")}
        </div>
      </AbsoluteFill>
    );
  return (
    <AbsoluteFill style={{ background, overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 40,
          width: 760,
          height: 760,
          borderRadius: "50%",
          background: glow,
        }}
      />
      <Phone w={470} {...phoneOf(card)} style={{ left: 265, top: 80 }} />
      <div
        style={{
          position: "absolute",
          left: 900,
          top: 0,
          height: 1080,
          width: 900,
          display: "flex",
          alignItems: "center",
        }}
      >
        {head(96, "left")}
      </div>
    </AbsoluteFill>
  );
};

const Callouts: React.FC<StyleProps> = ({ card, portrait }) =>
  portrait ? (
    <CalloutsPortrait card={card} />
  ) : (
    <CalloutsLandscape card={card} />
  );

const STYLES: Record<string, React.FC<StyleProps>> = {
  callouts: Callouts,
  light: Light,
  bold: Bold,
  minimal: Minimal,
};

export const StoreCard: React.FC<StoreCardProps> = (p) => {
  const Style = STYLES[p.style] ?? Callouts;
  return (
    <BrandProvider value={withDefaults(p.brand)}>
      <PaletteProvider value={{ ...DEFAULT_STORE_PALETTE, ...p.palette }}>
        <Style card={p.card} portrait={p.height > p.width} />
      </PaletteProvider>
    </BrandProvider>
  );
};

const FeatureInner: React.FC<FeatureGraphicProps> = (p) => {
  const b = useBrand();
  const { bg, deep, text, muted } = useStorePalette();
  const bold = p.style === "bold";
  const fg = bold ? b.colors.onAccent : text;
  return (
    <AbsoluteFill
      style={{
        background: bold
          ? b.colors.accent
          : `linear-gradient(135deg, ${bg} 0%, ${deep} 100%)`,
        overflow: "hidden",
      }}
    >
      {bold ? (
        <Stripes color={b.colors.onAccent} />
      ) : (
        <div
          style={{
            position: "absolute",
            left: 560,
            top: -160,
            width: 640,
            height: 640,
            borderRadius: "50%",
            background: `radial-gradient(circle, ${b.colors.accent}40 0%, transparent 65%)`,
          }}
        />
      )}
      <div
        style={{
          position: "absolute",
          left: 64,
          top: 0,
          height: 500,
          width: 600,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 18,
          fontFamily: MONT,
        }}
      >
        <Logo size={104} />
        <div
          style={{
            fontWeight: 900,
            fontSize: 76,
            color: fg,
            letterSpacing: -2,
            lineHeight: 1,
          }}
        >
          {bold ? b.name : <Wordmark />}
        </div>
        <div
          style={{
            fontWeight: 600,
            fontSize: 30,
            color: bold ? fg : muted,
            opacity: bold ? 0.85 : 1,
          }}
        >
          {p.tagline}
        </div>
      </div>
      <Phone
        w={300}
        screen={p.screen}
        screenRatio={p.screenRatio}
        statusBar={p.statusBar}
        style={{ left: 680, top: 46, transform: "rotate(-9deg)" }}
        shadow="0 40px 90px rgba(0,0,0,0.45)"
      />
    </AbsoluteFill>
  );
};

export const FeatureGraphic: React.FC<FeatureGraphicProps> = (p) => (
  <BrandProvider value={withDefaults(p.brand)}>
    <PaletteProvider value={{ ...DEFAULT_STORE_PALETTE, ...p.palette }}>
      <FeatureInner {...p} />
    </PaletteProvider>
  </BrandProvider>
);

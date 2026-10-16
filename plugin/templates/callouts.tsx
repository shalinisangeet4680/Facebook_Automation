import React from "react";
import { AbsoluteFill } from "remotion";
import { tone, useStorePalette } from "./brand";
import { Phone } from "./phone";
import { MONT } from "./theme";
import { Callout, CardProps } from "./types";

const CalloutCard: React.FC<{
  c: Callout;
  x: number;
  y: number;
  w: number;
  k: number;
}> = ({ c, x, y, w, k }) => {
  const { ink } = useStorePalette();
  const [bg, fg] = tone(c.tone);
  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        padding: `${30 * k}px ${34 * k}px ${34 * k}px`,
        borderRadius: 30 * k,
        background: "white",
        boxShadow: "0 30px 70px rgba(0,0,0,0.35), 0 6px 18px rgba(0,0,0,0.2)",
        fontFamily: MONT,
      }}
    >
      <span
        style={{
          display: "inline-block",
          padding: `${8 * k}px ${18 * k}px`,
          borderRadius: 999,
          background: bg,
          color: fg,
          fontWeight: 800,
          fontSize: 21 * k,
          letterSpacing: 2.5 * k,
        }}
      >
        {c.tag}
      </span>
      <div
        style={{
          marginTop: 16 * k,
          color: ink,
          fontWeight: 800,
          fontSize: 37 * k,
          lineHeight: 1.2,
          whiteSpace: "nowrap",
        }}
      >
        {c.text.map((ln, i) => (
          <div key={i}>{ln}</div>
        ))}
      </div>
      {c.toggles?.map(([label, on]) => (
        <div
          key={label}
          style={{
            marginTop: 14 * k,
            padding: `${14 * k}px ${18 * k}px`,
            borderRadius: 18 * k,
            background: "#F4F7FA",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: 28 * k,
            fontWeight: 600,
            color: ink,
          }}
        >
          <span>{label}</span>
          <span
            style={{
              width: 76 * k,
              height: 42 * k,
              borderRadius: 999,
              background: on ? ink : "#C9D4DE",
              position: "relative",
            }}
          >
            <span
              style={{
                position: "absolute",
                top: 5 * k,
                left: (on ? 39 : 5) * k,
                width: 32 * k,
                height: 32 * k,
                borderRadius: "50%",
                background: "white",
              }}
            />
          </span>
        </div>
      ))}
    </div>
  );
};

const Backdrop: React.FC<{
  arc: { size: number; left: number; top: number };
}> = ({ arc }) => {
  const { bg, ink, deep, muted, mid } = useStorePalette();
  return (
    <>
      <AbsoluteFill
        style={{
          background: `linear-gradient(165deg, ${bg} 0%, ${ink} 55%, ${deep} 100%)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `radial-gradient(${muted}14 1.5px, transparent 1.5px)`,
          backgroundSize: "40px 40px",
        }}
      />
      <div
        style={{
          position: "absolute",
          width: arc.size,
          height: arc.size,
          left: arc.left,
          top: arc.top,
          borderRadius: "50%",
          background: `linear-gradient(180deg, ${bg} 0%, ${mid} 60%)`,
        }}
      />
    </>
  );
};

export const CalloutsPortrait: React.FC<{ card: CardProps }> = ({ card }) => {
  const { text } = useStorePalette();
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Backdrop arc={{ size: 2200, left: -560, top: 1080 }} />
      <div
        style={{
          position: "absolute",
          left: 96,
          top: 96,
          width: 920,
          fontFamily: MONT,
          fontWeight: 800,
          fontSize: 96,
          lineHeight: 1.08,
          color: text,
          letterSpacing: -2,
        }}
      >
        {card.headline.map((ln, i) => (
          <div key={i}>{ln}</div>
        ))}
      </div>
      <Phone
        w={680}
        screen={card.screen}
        screenRatio={card.screenRatio}
        statusBar={card.statusBar}
        maxHeight={1920 - 400 - 46}
        style={{ left: 200, top: 400 }}
        shadow="0 60px 140px rgba(0,0,0,0.5)"
        ring
      />
      {card.callouts.map((c, i) => (
        <CalloutCard key={i} c={c} x={c.x} y={c.y} w={c.w ?? 440} k={1} />
      ))}
    </AbsoluteFill>
  );
};

const TW = 1920;
const PHONE_W = 500;
const PHONE_LEFT = (TW - PHONE_W) / 2;
const CARD_W = 440;
const LEFT_X = PHONE_LEFT - CARD_W + 90;
const RIGHT_X = PHONE_LEFT + PHONE_W - 90;

const SLOTS: { x: number; y: number }[][] = [
  [{ x: RIGHT_X, y: 420 }],
  [
    { x: LEFT_X, y: 360 },
    { x: RIGHT_X, y: 560 },
  ],
  [
    { x: LEFT_X, y: 320 },
    { x: RIGHT_X, y: 450 },
    { x: LEFT_X, y: 650 },
  ],
  [
    { x: LEFT_X, y: 320 },
    { x: RIGHT_X, y: 290 },
    { x: LEFT_X, y: 640 },
    { x: RIGHT_X, y: 560 },
  ],
];

export const CalloutsLandscape: React.FC<{ card: CardProps }> = ({ card }) => {
  const { text } = useStorePalette();
  const callouts = card.callouts.slice(0, 4);
  const slots = SLOTS[Math.max(callouts.length, 1) - 1] ?? [];
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Backdrop arc={{ size: 3000, left: (TW - 3000) / 2, top: 620 }} />
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 64,
          width: TW,
          textAlign: "center",
          fontFamily: MONT,
          fontWeight: 800,
          fontSize: 76,
          lineHeight: 1.1,
          color: text,
          letterSpacing: -1.5,
          whiteSpace: "nowrap",
        }}
      >
        {card.headline.join(" ")}
      </div>
      <Phone
        w={PHONE_W}
        screen={card.screen}
        screenRatio={card.screenRatio}
        statusBar={card.statusBar}
        maxHeight={1080 - 210 - 34}
        style={{ left: PHONE_LEFT, top: 210 }}
        shadow="0 44px 110px rgba(0,0,0,0.5)"
        ring
      />
      {callouts.map((c, i) => {
        const slot = slots[i] ?? { x: RIGHT_X, y: 420 };
        return (
          <CalloutCard
            key={i}
            c={c}
            x={slot.x}
            y={slot.y}
            w={CARD_W}
            k={0.86}
          />
        );
      })}
    </AbsoluteFill>
  );
};

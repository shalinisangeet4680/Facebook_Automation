"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const IDS = ["g", "p", "ig", "fb", "m", "gp"] as const;

export type HeroNodeId = (typeof IDS)[number];
type Side = "top" | "bottom" | "left" | "right";
type Heights = Record<HeroNodeId, number>;

const W = 1060;
const CARD = 250;
const GAP = 120;
const SPREAD = 140;
const STACKED = "(max-width: 1100px)";
const INITIAL: Heights = { g: 316, p: 334, ig: 313, fb: 300, m: 254, gp: 249 };
const INNER = { l: W / 2 - SPREAD - CARD / 2, r: W / 2 + SPREAD - CARD / 2 };
const ORBIT = { rx: W / 2 - CARD, ry: GAP / Math.sqrt(1 - (SPREAD / (W / 2 - CARD)) ** 2) };

const SPEC: Record<HeroNodeId, { color: string; plug: Side }> = {
  g: { color: "#0F6B4A", plug: "bottom" },
  p: { color: "#E8590C", plug: "bottom" },
  ig: { color: "#C2185B", plug: "right" },
  fb: { color: "#2D5BD7", plug: "left" },
  m: { color: "#1C64B8", plug: "top" },
  gp: { color: "#0F6B4A", plug: "top" },
};

const PLUG: Record<Side, CSSProperties> = {
  bottom: { bottom: -5, left: CARD / 2 - 5 },
  top: { top: -5, left: CARD / 2 - 5 },
  right: { right: -5, top: "50%", marginTop: -5 },
  left: { left: -5, top: "50%", marginTop: -5 },
};

function layout(h: Heights) {
  const topRow = Math.max(h.g, h.p, Math.max(h.ig, h.fb) / 2 - GAP);
  const hub = { x: W / 2, y: topRow + GAP };
  const bottom = hub.y + GAP;
  const height = Math.max(bottom + Math.max(h.m, h.gp), hub.y + Math.max(h.ig, h.fb) / 2);
  const place: Record<HeroNodeId, { left: number; top: number }> = {
    g: { left: INNER.l, top: topRow - h.g },
    p: { left: INNER.r, top: topRow - h.p },
    ig: { left: 0, top: hub.y - h.ig / 2 },
    fb: { left: W - CARD, top: hub.y - h.fb / 2 },
    m: { left: INNER.l, top: bottom },
    gp: { left: INNER.r, top: bottom },
  };
  const anchor = (id: HeroNodeId) => {
    const side = SPEC[id].plug;
    if (side === "bottom") return { x: place[id].left + CARD / 2, y: topRow };
    if (side === "top") return { x: place[id].left + CARD / 2, y: bottom };
    if (side === "right") return { x: CARD, y: hub.y };
    return { x: W - CARD, y: hub.y };
  };
  const wire = (id: HeroNodeId) => {
    const a = anchor(id);
    return `M ${hub.x} ${hub.y} L ${a.x} ${a.y}`;
  };
  return { hub, height, place, wire };
}

export interface HeroCard {
  id: HeroNodeId;
  label: string;
  title: string;
  delay?: number;
  children: ReactNode;
}

export function HeroLayout({ hub, cards }: { hub: ReactNode; cards: HeroCard[] }) {
  const [heights, setHeights] = useState<Heights>(INITIAL);
  const nodes = useRef<Partial<Record<HeroNodeId, HTMLDivElement | null>>>({});

  useEffect(() => {
    if (typeof ResizeObserver === "undefined") return;
    const stacked = window.matchMedia(STACKED);
    const measure = () => {
      if (stacked.matches) return;
      const next = { ...INITIAL };
      for (const id of IDS) {
        const el = nodes.current[id];
        if (!el) return;
        next[id] = Math.round(el.offsetHeight);
      }
      setHeights((prev) => (IDS.every((id) => prev[id] === next[id]) ? prev : next));
    };
    const observer = new ResizeObserver(measure);
    for (const id of IDS) {
      const el = nodes.current[id];
      if (el) observer.observe(el);
    }
    stacked.addEventListener("change", measure);
    return () => {
      observer.disconnect();
      stacked.removeEventListener("change", measure);
    };
  }, []);

  const { hub: center, height, place, wire } = layout(heights);

  return (
    <div className="tv-stage" style={{ width: W, height }} aria-hidden>
      <svg className="tv-wires" viewBox={`0 0 ${W} ${height}`} style={{ width: W, height }}>
        <ellipse className="tv-orbit" cx={center.x} cy={center.y} rx={ORBIT.rx} ry={ORBIT.ry} />
        {IDS.map((id) => (
          <path key={id} id={`wire-${id}`} className="tv-wire" d={wire(id)} />
        ))}
        {IDS.map((id, i) => (
          <circle key={id} className="tv-pulse" r="4" fill={SPEC[id].color}>
            <animateMotion
              dur="2.8s"
              begin={`${i * 0.45}s`}
              repeatCount="indefinite"
              keyPoints="1;0"
              keyTimes="0;1"
              calcMode="linear"
              path={wire(id)}
            />
          </circle>
        ))}
      </svg>
      <div className="tv-hub" style={{ left: center.x - 52, top: center.y - 52 }}>
        {hub}
      </div>
      {cards.map((card) => (
        <div
          key={card.id}
          ref={(el) => {
            nodes.current[card.id] = el;
          }}
          className={`tv-node tv-card tv-shadow tv-mini tv-d${card.delay ?? 0}`}
          data-node={card.id}
          style={place[card.id]}
        >
          <span
            className="tv-plug"
            style={{ background: SPEC[card.id].color, ...PLUG[SPEC[card.id].plug] }}
          />
          <div className="tv-miniHead">
            <span className="tv-eyebrowDot" style={{ background: SPEC[card.id].color }} />
            {card.label}
          </div>
          <span className="tv-nodeTitle">{card.title}</span>
          {card.children}
        </div>
      ))}
    </div>
  );
}

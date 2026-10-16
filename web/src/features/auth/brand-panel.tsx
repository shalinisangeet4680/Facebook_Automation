"use client";

import {
  CheckCircle2,
  Lock,
  MapPin,
  MessageSquareReply,
  Pause,
  Rocket,
  Sparkles,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useState } from "react";

import { Logo } from "@/components/brand/logo";
import { BRAND } from "@/lib/config";

const CARDS = [
  {
    icon: Rocket,
    tone: "bg-indigo-500/15 text-indigo-200",
    kicker: "Needs your approval",
    title: "Launch campaign",
    body: "6 ads · ₹1,000/day · Patna, 25 km",
    action: "Approve",
  },
  {
    icon: MessageSquareReply,
    tone: "bg-emerald-500/15 text-emerald-200",
    kicker: "Play review reply",
    title: "Reply drafted for ★★☆☆☆",
    body: "“Login fails after update” · ClinicPro",
    action: "Approve",
  },
  {
    icon: Pause,
    tone: "bg-amber-500/15 text-amber-200",
    kicker: "Done automatically",
    title: "Paused ad D",
    body: "₹800 spent with no results",
    action: "View",
  },
  {
    icon: MapPin,
    tone: "bg-fuchsia-500/15 text-fuchsia-200",
    kicker: "Google Business",
    title: "Diwali offer post scheduled",
    body: "Patna clinic · Goes live Fri 10:00",
    action: "Open",
  },
];

const POINTS = [
  { icon: CheckCircle2, text: "You approve every launch, reply and post that matters." },
  { icon: Sparkles, text: "Meta ads, Google Play and Google Business in one place." },
  { icon: Lock, text: "Every key and sign-in is encrypted and never shown again." },
];

export function BrandPanel() {
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % CARDS.length), 3200);
    return () => window.clearInterval(id);
  }, [reduce]);

  const visible = [0, 1, 2].map((offset) => CARDS[(index + offset) % CARDS.length]!);

  return (
    <div className="relative hidden h-full flex-col overflow-hidden bg-[#0d0c22] p-12 text-white lg:flex">
      <div
        aria-hidden
        className="absolute inset-0 [background-image:linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_60%_40%,black,transparent_75%)] [background-size:44px_44px] opacity-[0.35]"
      />
      <div
        aria-hidden
        className="absolute -top-40 -right-40 size-[520px] rounded-full bg-indigo-600/25 blur-[120px]"
      />
      <Logo inverted className="relative" />

      <div className="relative mt-auto mb-auto pt-16">
        <h1 className="text-display max-w-md font-semibold tracking-tight">{BRAND.tagline}.</h1>
        <p className="mt-4 max-w-md text-[16px] leading-7 text-white/65">{BRAND.description}</p>

        <div className="relative mt-12 h-[264px] max-w-md" aria-hidden>
          <AnimatePresence initial={false} mode="popLayout">
            {visible.map((card, i) => {
              const Icon = card.icon;
              return (
                <motion.div
                  key={card.title}
                  layout
                  initial={{ opacity: 0, y: 40, scale: 0.94 }}
                  animate={{
                    opacity: 1 - i * 0.3,
                    y: i * 14,
                    scale: 1 - i * 0.05,
                    zIndex: 3 - i,
                  }}
                  exit={{ opacity: 0, y: -30, scale: 1.02 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-x-0 top-0 rounded-[16px] border border-white/10 bg-[#1b1a3a] p-5 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)]"
                >
                  <motion.div
                    animate={{ opacity: i === 0 ? 1 : 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-start gap-4"
                  >
                    <span className={`grid size-10 place-items-center rounded-[10px] ${card.tone}`}>
                      <Icon className="size-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-caption font-medium tracking-wide text-white/50 uppercase">
                        {card.kicker}
                      </p>
                      <p className="mt-1 text-[16px] font-semibold">{card.title}</p>
                      <p className="text-small mt-0.5 text-white/60">{card.body}</p>
                    </div>
                    <span className="text-small rounded-[8px] bg-white px-3 py-1.5 font-semibold text-[#0d0c22]">
                      {card.action}
                    </span>
                  </motion.div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>

      <ul className="relative mt-10 grid gap-3">
        {POINTS.map(({ icon: Icon, text }) => (
          <li key={text} className="text-small flex items-center gap-3 text-white/70">
            <Icon className="size-4 text-indigo-300" />
            {text}
          </li>
        ))}
      </ul>
    </div>
  );
}

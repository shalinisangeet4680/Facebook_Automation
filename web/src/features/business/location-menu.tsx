"use client";

import { useEffect, useId, useRef, useState } from "react";

import { useLocationColors, useLocationFilter } from "./shell";

type Option = {
  id: string;
  title: string;
  sub: string;
  color: string | null;
  waiting: number;
};

function Mark({ option, size }: { option: Option; size: number }) {
  return (
    <span
      className="gb-lm-mark"
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: option.color ?? "var(--gb-ink)",
        fontSize: size * 0.42,
      }}
    >
      {option.color ? (
        (option.title.trim()[0] ?? "?").toUpperCase()
      ) : (
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 16 16" fill="#fff">
          <rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.5" />
          <rect x="9" y="1.5" width="5.5" height="5.5" rx="1.5" />
          <rect x="1.5" y="9" width="5.5" height="5.5" rx="1.5" />
          <rect x="9" y="9" width="5.5" height="5.5" rx="1.5" />
        </svg>
      )}
    </span>
  );
}

export function LocationMenu({ compact }: { compact?: boolean }) {
  const { loc, setLoc } = useLocationFilter();
  const { locations, color } = useLocationColors();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();

  const total = locations.reduce((n, l) => n + l.needsReply, 0);
  const options: Option[] = [
    {
      id: "all",
      title: "All locations",
      sub: `${locations.length} location${locations.length === 1 ? "" : "s"}`,
      color: null,
      waiting: total,
    },
    ...locations.map((l) => ({
      id: l.id,
      title: l.title,
      sub: l.address ?? l.category ?? "Google Business Profile",
      color: color(l.id),
      waiting: l.needsReply,
    })),
  ];
  const selected = options.find((o) => o.id === loc) ?? options[0]!;

  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", away);
    list.current?.focus();
    return () => document.removeEventListener("pointerdown", away);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({
      block: "nearest",
    });
  }, [open, active]);

  const show = () => {
    setActive(
      Math.max(
        0,
        options.findIndex((o) => o.id === selected.id),
      ),
    );
    setOpen(true);
  };
  const choose = (o: Option) => {
    setLoc(o.id);
    setOpen(false);
    button.current?.focus();
  };

  return (
    <div ref={root} className={compact ? "gb-lm gb-lm-compact" : "gb-lm"}>
      <button
        ref={button}
        type="button"
        className="gb-lm-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-label={`Location: ${selected.title}`}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            show();
          }
        }}
      >
        <Mark option={selected} size={compact ? 22 : 28} />
        <span className="gb-lm-text">
          <span className="gb-lm-title">{selected.title}</span>
          {compact ? null : <span className="gb-lm-sub">{selected.sub}</span>}
        </span>
        <svg
          className="gb-lm-chev"
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="m5 6 3-3 3 3M5 10l3 3 3-3" />
        </svg>
      </button>
      {open ? (
        <ul
          ref={list}
          id={`${id}-list`}
          role="listbox"
          tabIndex={-1}
          aria-label="Choose a location"
          aria-activedescendant={`${id}-${active}`}
          className="gb-lm-pop"
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((i) => Math.min(options.length - 1, i + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(0, i - 1));
            } else if (e.key === "Home") {
              e.preventDefault();
              setActive(0);
            } else if (e.key === "End") {
              e.preventDefault();
              setActive(options.length - 1);
            } else if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              choose(options[active]!);
            } else if (e.key === "Escape" || e.key === "Tab") {
              setOpen(false);
              if (e.key === "Escape") button.current?.focus();
            }
          }}
        >
          {options.map((o, i) => (
            <li
              key={o.id}
              id={`${id}-${i}`}
              data-index={i}
              role="option"
              aria-selected={o.id === selected.id}
              className={i === active ? "gb-lm-opt gb-lm-opt-active" : "gb-lm-opt"}
              onPointerEnter={() => setActive(i)}
              onClick={() => choose(o)}
            >
              <Mark option={o} size={30} />
              <span className="gb-lm-text">
                <span className="gb-lm-title">{o.title}</span>
                <span className="gb-lm-sub">{o.sub}</span>
              </span>
              {o.waiting > 0 ? (
                <span className="gb-lm-count" aria-label={`${o.waiting} waiting`}>
                  {o.waiting > 99 ? "99+" : o.waiting}
                </span>
              ) : null}
              <span className="gb-lm-check" aria-hidden>
                {o.id === selected.id ? (
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m3.5 8.5 3 3 6-7" />
                  </svg>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

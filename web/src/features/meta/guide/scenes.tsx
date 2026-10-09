"use client";

import { Check, ChevronDown, Copy, Settings } from "lucide-react";
import { motion } from "motion/react";

import { BRAND } from "@/lib/config";

import { Cursor, Pulse, Reveal } from "./cursor";

const META_BLUE = "#0866ff";
const panel = "bg-white dark:bg-[#242526]";
const line = "border-[#dadde1] dark:border-[#3e4042]";
const soft = "text-[#65676b] dark:text-[#b0b3b8]";

function Bar({ w, className = "" }: { w: string; className?: string }) {
  return (
    <span
      className={`block h-2 rounded-full bg-[#e4e6eb] dark:bg-[#3a3b3c] ${className}`}
      style={{ width: w }}
    />
  );
}

function Toggle({ delay }: { delay: number }) {
  return (
    <motion.span
      className="relative inline-flex h-4 w-7 items-center rounded-full"
      initial={{ backgroundColor: "#ccd0d5" }}
      animate={{ backgroundColor: META_BLUE }}
      transition={{ delay, duration: 0.25 }}
    >
      <motion.span
        className="absolute size-3 rounded-full bg-white shadow"
        initial={{ left: 2 }}
        animate={{ left: 14 }}
        transition={{ delay, duration: 0.25 }}
      />
    </motion.span>
  );
}

function Tick({ delay }: { delay: number }) {
  return (
    <span className="grid size-3.5 place-items-center rounded-[3px] border border-[#ccd0d5] dark:border-[#4e4f50]">
      <motion.span
        className="grid size-3.5 place-items-center rounded-[3px]"
        style={{ backgroundColor: META_BLUE }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay, duration: 0.2 }}
      >
        <Check className="size-2.5 text-white" strokeWidth={4} />
      </motion.span>
    </span>
  );
}

function SettingsNav({ active }: { active: string }) {
  const groups = [
    { title: "Users", items: ["People", "Partners", "System users"] },
    { title: "Accounts", items: ["Pages", "Ad accounts", "Apps"] },
    { title: "Data sources", items: ["Datasets"] },
  ];
  return (
    <div
      className={`absolute inset-y-0 left-0 w-[24%] border-r ${line} ${panel} p-[2.5%] text-[10px]`}
    >
      <p className="mb-3 text-[11px] font-bold">Business settings</p>
      {groups.map((g) => (
        <div key={g.title} className="mb-2.5">
          <p className={`mb-1 font-semibold ${soft}`}>{g.title}</p>
          {g.items.map((i) => (
            <p
              key={i}
              className={`rounded-[4px] px-1.5 py-[3px] ${i === active ? "bg-[#e7f0ff] font-semibold text-[#0050c8] dark:bg-[#263951] dark:text-[#9fc4ff]" : ""}`}
            >
              {i}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

function Modal({
  title,
  delay,
  children,
  className = "",
}: {
  title: string;
  delay: number;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <>
      <motion.div
        className="absolute inset-0 z-10 bg-black/30"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay, duration: 0.25 }}
      />
      <motion.div
        className={`absolute top-1/2 left-1/2 z-10 w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-[8px] border ${line} ${panel} p-[3%] text-[10px] shadow-xl ${className}`}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <p className="mb-2.5 text-[12px] font-bold">{title}</p>
        {children}
      </motion.div>
    </>
  );
}

function PrimaryBtn({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-[6px] px-2.5 py-1 text-[10px] font-semibold text-white ${className}`}
      style={{ backgroundColor: META_BLUE }}
    >
      {children}
    </span>
  );
}

export function SceneOpenSettings() {
  return (
    <>
      <div
        className={`absolute inset-y-0 left-0 w-[22%] border-r ${line} ${panel} p-[2.5%] text-[10px]`}
      >
        <p className="mb-3 text-[11px] font-bold">Business Suite</p>
        {["Home", "Notifications", "Ads", "Insights"].map((i, n) => (
          <p
            key={i}
            className={`rounded-[4px] px-1.5 py-[3px] ${n === 0 ? "bg-[#e7f0ff] font-semibold text-[#0050c8] dark:bg-[#263951] dark:text-[#9fc4ff]" : ""}`}
          >
            {i}
          </p>
        ))}
        <p className="mt-auto mb-[8%] flex items-center gap-1 px-1.5 font-semibold">
          <Settings className="size-3" /> Settings
        </p>
      </div>
      <div className="absolute inset-y-0 right-0 left-[22%] grid grid-cols-2 gap-[3%] p-[4%]">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`rounded-[8px] border ${line} ${panel} grid content-start gap-2 p-[6%]`}
          >
            <Bar w="45%" />
            <Bar w="80%" />
            <Bar w="60%" />
          </div>
        ))}
      </div>
      <Pulse delay={1.9} className="bottom-[8%] left-[4%] h-[7%] w-[15%]" />
      <Reveal delay={2.7} from={0} className="absolute inset-0 z-10 bg-[#f6f7f9] dark:bg-[#18191a]">
        <SettingsNav active="People" />
        <div className="absolute inset-y-0 right-0 left-[24%] p-[4%] text-[10px]">
          <p className="text-[13px] font-bold">Business settings</p>
          <p className={`mt-1 ${soft}`}>Manage people, assets and access for your business.</p>
          <div className="mt-4 grid gap-2">
            <Bar w="70%" />
            <Bar w="50%" />
          </div>
        </div>
      </Reveal>
      <Cursor
        duration={1.8}
        stops={[
          { x: 60, y: 40 },
          { x: 11, y: 87, click: true },
          { x: 11, y: 87 },
        ]}
      />
    </>
  );
}

export function SceneCreateApp() {
  return (
    <>
      <div
        className={`absolute inset-x-0 top-0 flex h-[13%] items-center border-b ${line} ${panel} px-[4%] text-[11px] font-bold`}
      >
        Meta for Developers
        <span className="ml-auto">
          <PrimaryBtn>Create app</PrimaryBtn>
        </span>
      </div>
      <div className="absolute inset-x-0 top-[13%] bottom-0 p-[4%] text-[10px]">
        <p className="text-[13px] font-bold">Apps</p>
        <div className={`mt-3 grid grid-cols-3 gap-[3%]`}>
          {[0, 1, 2].map((i) => (
            <div key={i} className={`rounded-[8px] border ${line} ${panel} grid gap-2 p-[8%]`}>
              <Bar w="50%" />
              <Bar w="80%" />
            </div>
          ))}
        </div>
      </div>
      <Pulse delay={1.2} className="top-[3%] right-[3%] h-[7%] w-[13%]" />
      <Modal title="Select an app type" delay={2}>
        {[
          ["Business", "Manage ads, Pages and business assets with the Marketing API."],
          ["Consumer", "Facebook Login and other consumer features."],
          ["Gaming", "Games on Facebook."],
        ].map(([t, d], i) => (
          <div
            key={t}
            className={`mb-1.5 flex items-center gap-2 rounded-[6px] border p-1.5 ${i === 0 ? "" : line}`}
            style={i === 0 ? { borderColor: META_BLUE } : undefined}
          >
            <span
              className="grid size-3 place-items-center rounded-full border"
              style={{ borderColor: i === 0 ? META_BLUE : "#ccd0d5" }}
            >
              {i === 0 ? (
                <motion.span
                  className="size-1.5 rounded-full"
                  style={{ backgroundColor: META_BLUE }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 3.3 }}
                />
              ) : null}
            </span>
            <span>
              <span className="block font-semibold">{t}</span>
              <span className={`block text-[9px] ${soft}`}>{d}</span>
            </span>
          </div>
        ))}
        <div className="mt-2 text-right">
          <PrimaryBtn>Next</PrimaryBtn>
        </div>
      </Modal>
      <Cursor
        duration={3.6}
        stops={[
          { x: 50, y: 60 },
          { x: 89, y: 6.5, click: true },
          { x: 89, y: 6.5 },
          { x: 33, y: 38, click: true },
          { x: 75, y: 76, click: true },
        ]}
      />
    </>
  );
}

export function SceneAddSystemUser() {
  return (
    <>
      <SettingsNav active="System users" />
      <div className="absolute inset-y-0 right-0 left-[24%] p-[4%] text-[10px]">
        <div className="flex items-center">
          <p className="text-[13px] font-bold">System users</p>
          <span className="ml-auto">
            <PrimaryBtn>+ Add</PrimaryBtn>
          </span>
        </div>
        <p className={`mt-1 ${soft}`}>
          System users act on behalf of your business through the API.
        </p>
      </div>
      <Pulse delay={1.1} className="top-[5%] right-[3.6%] h-[7%] w-[8.5%]" />
      <Modal title="Create system user" delay={1.8}>
        <p className={`mb-1 ${soft}`}>System username</p>
        <div className={`mb-2.5 rounded-[6px] border ${line} px-2 py-1.5`}>
          <motion.span
            className="inline-block overflow-hidden align-bottom whitespace-nowrap"
            initial={{ width: 0 }}
            animate={{ width: "auto" }}
            transition={{ delay: 2.4, duration: 0.8 }}
          >
            {BRAND.name}
          </motion.span>
        </div>
        <p className={`mb-1 ${soft}`}>System user role</p>
        <div className={`mb-3 flex items-center rounded-[6px] border ${line} px-2 py-1.5`}>
          <Reveal delay={3.4} from={0}>
            <span className="font-semibold">Admin</span>
          </Reveal>
          <ChevronDown className="ml-auto size-3" />
        </div>
        <div className="text-right">
          <PrimaryBtn>Create system user</PrimaryBtn>
        </div>
      </Modal>
      <Cursor
        duration={3.8}
        stops={[
          { x: 50, y: 50 },
          { x: 92, y: 8, click: true },
          { x: 50, y: 52 },
          { x: 50, y: 66, click: true },
          { x: 70, y: 78, click: true },
        ]}
      />
    </>
  );
}

export function SceneAssignAssets() {
  const rows = [
    { type: "Ad accounts", name: "Ad account", delay: 1.6 },
    { type: "Pages", name: "Facebook Page", delay: 2.5 },
    { type: "Instagram", name: "Instagram account", delay: 3.3 },
    { type: "Datasets", name: "Dataset (Pixel)", delay: 4.1 },
  ];
  return (
    <>
      <SettingsNav active="System users" />
      <Modal title="Assign assets" delay={0.3} className="w-[64%]">
        <div className="grid gap-1">
          {rows.map((r) => (
            <div
              key={r.type}
              className={`flex items-center gap-2 rounded-[6px] border ${line} px-2 py-1.5`}
            >
              <Tick delay={r.delay - 0.3} />
              <span className="flex-1">
                <span className="block font-semibold">{r.name}</span>
                <span className={`block text-[9px] ${soft}`}>{r.type}</span>
              </span>
              <span className={soft}>Full control</span>
              <Toggle delay={r.delay} />
            </div>
          ))}
        </div>
        <div className="mt-2 text-right">
          <PrimaryBtn>Assign assets</PrimaryBtn>
        </div>
      </Modal>
      <Cursor
        duration={4.2}
        stops={[
          { x: 45, y: 30 },
          { x: 74, y: 31, click: true },
          { x: 74, y: 44, click: true },
          { x: 74, y: 57, click: true },
          { x: 74, y: 70, click: true },
          { x: 73, y: 82, click: true },
        ]}
      />
    </>
  );
}

export function SceneGenerateToken({ permissions }: { permissions: string[] }) {
  const shown = permissions.slice(0, 7);
  return (
    <>
      <SettingsNav active="System users" />
      <Modal title="Generate token" delay={0.3} className="w-[62%]">
        <div className="mb-2 grid grid-cols-2 gap-2">
          <div>
            <p className={`mb-1 ${soft}`}>App</p>
            <div className={`flex items-center rounded-[6px] border ${line} px-2 py-1`}>
              <span className="font-semibold">{BRAND.name}</span>
              <ChevronDown className="ml-auto size-3" />
            </div>
          </div>
          <div>
            <p className={`mb-1 ${soft}`}>Token expiration</p>
            <div
              className="flex items-center rounded-[6px] border px-2 py-1"
              style={{ borderColor: META_BLUE }}
            >
              <span className="font-semibold">Never</span>
              <ChevronDown className="ml-auto size-3" />
            </div>
          </div>
        </div>
        <p className={`mb-1 ${soft}`}>Permissions</p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1">
          {shown.map((p, i) => (
            <span key={p} className="flex items-center gap-1.5 font-mono text-[9px]">
              <Tick delay={1.3 + i * 0.35} />
              {p}
            </span>
          ))}
        </div>
        <div className="mt-2.5 text-right">
          <PrimaryBtn>Generate token</PrimaryBtn>
        </div>
      </Modal>
      <Cursor
        duration={4.4}
        stops={[
          { x: 30, y: 30 },
          { x: 62, y: 35, click: true },
          { x: 30, y: 48, click: true },
          { x: 30, y: 60, click: true },
          { x: 55, y: 60, click: true },
          { x: 73, y: 79, click: true },
        ]}
      />
    </>
  );
}

export function SceneCopyToken() {
  return (
    <>
      <SettingsNav active="System users" />
      <Modal title="Token generated" delay={0.2}>
        <p className={`mb-2 ${soft}`}>Copy this token now. Meta won&apos;t show it again.</p>
        <div
          className={`flex items-center gap-2 rounded-[6px] border ${line} bg-[#f0f2f5] px-2 py-1.5 dark:bg-[#3a3b3c]`}
        >
          <span className="flex-1 truncate font-mono text-[9px]">
            EAAG•••••••••••••••••••••••••••••Zd3
          </span>
          <span className="inline-flex items-center gap-1 rounded-[5px] border border-[#ccd0d5] px-1.5 py-0.5 text-[9px] font-semibold dark:border-[#4e4f50]">
            <Copy className="size-2.5" /> Copy
          </span>
        </div>
        <Reveal
          delay={2.1}
          from={4}
          className="mt-2.5 inline-flex items-center gap-1 rounded-full bg-[#e6f4ea] px-2 py-0.5 text-[9px] font-semibold text-[#1e8e3e] dark:bg-[#1e3a26]"
        >
          <Check className="size-2.5" strokeWidth={3} /> Copied to clipboard
        </Reveal>
      </Modal>
      <Reveal
        delay={2.8}
        from={0}
        className="absolute right-[4%] bottom-[8%] z-20 flex items-center gap-2 rounded-full bg-[var(--accent)] px-3 py-1.5 text-[11px] font-semibold text-[var(--accent-foreground)] shadow-lg"
      >
        Now paste it into {BRAND.name} →
      </Reveal>
      <Cursor
        duration={1.8}
        stops={[
          { x: 40, y: 40 },
          { x: 72, y: 50, click: true },
          { x: 72, y: 50 },
        ]}
      />
    </>
  );
}

"use client";

import { Check, ChevronDown, Copy, Settings } from "lucide-react";
import { motion } from "motion/react";
import type { CSSProperties, ReactNode } from "react";

import { BRAND } from "@/lib/config";

import { Cursor, Pulse, Reveal } from "./cursor";

const META_BLUE = "#0866ff";
const LINE = "#dadde1";
const SOFT = "#65676b";

const flex = (gap: number, extra?: CSSProperties): CSSProperties => ({
  display: "flex",
  alignItems: "center",
  gap,
  ...extra,
});

const box: CSSProperties = { borderRadius: 6, border: `1px solid ${LINE}` };
const card: CSSProperties = { borderRadius: 8, border: `1px solid ${LINE}`, background: "#fff" };
const soft: CSSProperties = { color: SOFT };
const bold = (fontSize: number): CSSProperties => ({ fontSize, fontWeight: 700, margin: 0 });
const navActive: CSSProperties = { background: "#e7f0ff", fontWeight: 600, color: "#0050c8" };
const navItem: CSSProperties = { borderRadius: 4, padding: "3px 6px", margin: 0 };

function Bar({ w }: { w: string }) {
  return (
    <span
      style={{ display: "block", height: 8, borderRadius: 999, background: "#e4e6eb", width: w }}
    />
  );
}

function Toggle({ delay }: { delay: number }) {
  return (
    <motion.span
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        height: 16,
        width: 28,
        borderRadius: 999,
      }}
      initial={{ backgroundColor: "#ccd0d5" }}
      animate={{ backgroundColor: META_BLUE }}
      transition={{ delay, duration: 0.25 }}
    >
      <motion.span
        style={{
          position: "absolute",
          width: 12,
          height: 12,
          borderRadius: 999,
          background: "#fff",
          boxShadow: "0 1px 2px rgba(0,0,0,.2)",
        }}
        initial={{ left: 2 }}
        animate={{ left: 14 }}
        transition={{ delay, duration: 0.25 }}
      />
    </motion.span>
  );
}

function Tick({ delay }: { delay: number }) {
  const square: CSSProperties = {
    width: 14,
    height: 14,
    borderRadius: 3,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    boxSizing: "border-box",
  };
  return (
    <span style={{ ...square, border: "1px solid #ccd0d5" }}>
      <motion.span
        style={{ ...square, backgroundColor: META_BLUE }}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay, duration: 0.2 }}
      >
        <Check size={10} color="#fff" strokeWidth={4} />
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
      style={{
        position: "absolute",
        top: 0,
        bottom: 0,
        left: 0,
        width: "24%",
        borderRight: `1px solid ${LINE}`,
        background: "#fff",
        padding: "2.5%",
        fontSize: 10,
      }}
    >
      <p style={{ ...bold(11), marginBottom: 12 }}>Business settings</p>
      {groups.map((g) => (
        <div key={g.title} style={{ marginBottom: 10 }}>
          <p style={{ ...soft, fontWeight: 600, margin: "0 0 4px" }}>{g.title}</p>
          {g.items.map((i) => (
            <p key={i} style={{ ...navItem, ...(i === active ? navActive : null) }}>
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
  width = "58%",
}: {
  title: string;
  delay: number;
  children: ReactNode;
  width?: string;
}) {
  return (
    <>
      <motion.div
        style={{ position: "absolute", inset: 0, zIndex: 10, background: "rgba(0,0,0,.3)" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay, duration: 0.25 }}
      />
      <motion.div
        style={{
          ...card,
          position: "absolute",
          top: "50%",
          left: "50%",
          x: "-50%",
          y: "-50%",
          zIndex: 10,
          width,
          padding: "3%",
          fontSize: 10,
          boxShadow: "0 20px 25px -5px rgba(0,0,0,.15), 0 8px 10px -6px rgba(0,0,0,.1)",
        }}
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay, duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      >
        <p style={{ ...bold(12), marginBottom: 10 }}>{title}</p>
        {children}
      </motion.div>
    </>
  );
}

function PrimaryBtn({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 6,
        padding: "4px 10px",
        fontSize: 10,
        fontWeight: 600,
        color: "#fff",
        backgroundColor: META_BLUE,
      }}
    >
      {children}
    </span>
  );
}

const fill = (left: string): CSSProperties => ({
  position: "absolute",
  top: 0,
  bottom: 0,
  right: 0,
  left,
  padding: "4%",
  fontSize: 10,
});

export function SceneOpenSettings() {
  return (
    <>
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: "22%",
          borderRight: `1px solid ${LINE}`,
          background: "#fff",
          padding: "2.5%",
          fontSize: 10,
        }}
      >
        <p style={{ ...bold(11), marginBottom: 12 }}>Business Suite</p>
        {["Home", "Notifications", "Ads", "Insights"].map((i, n) => (
          <p key={i} style={{ ...navItem, ...(n === 0 ? navActive : null) }}>
            {i}
          </p>
        ))}
        <p
          style={flex(4, {
            position: "absolute",
            bottom: "8%",
            left: "2.5%",
            padding: "0 6px",
            margin: 0,
            fontWeight: 600,
          })}
        >
          <Settings size={12} /> Settings
        </p>
      </div>
      <div
        style={{
          ...fill("22%"),
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "3%",
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              ...card,
              display: "grid",
              alignContent: "start",
              gap: 8,
              padding: "6%",
            }}
          >
            <Bar w="45%" />
            <Bar w="80%" />
            <Bar w="60%" />
          </div>
        ))}
      </div>
      <Pulse delay={1.9} style={{ bottom: "8%", left: "4%", height: "7%", width: "15%" }} />
      <Reveal
        delay={2.7}
        from={0}
        style={{ position: "absolute", inset: 0, zIndex: 10, background: "#f6f7f9" }}
      >
        <SettingsNav active="People" />
        <div style={fill("24%")}>
          <p style={bold(13)}>Business settings</p>
          <p style={{ ...soft, margin: "4px 0 0" }}>
            Manage people, assets and access for your business.
          </p>
          <div style={{ marginTop: 16, display: "grid", gap: 8 }}>
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
        style={flex(0, {
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "13%",
          borderBottom: `1px solid ${LINE}`,
          background: "#fff",
          padding: "0 4%",
          fontSize: 11,
          fontWeight: 700,
        })}
      >
        Meta for Developers
        <span style={{ marginLeft: "auto" }}>
          <PrimaryBtn>Create app</PrimaryBtn>
        </span>
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: "13%",
          bottom: 0,
          padding: "4%",
          fontSize: 10,
        }}
      >
        <p style={bold(13)}>Apps</p>
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "3%",
          }}
        >
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ ...card, display: "grid", gap: 8, padding: "8%" }}>
              <Bar w="50%" />
              <Bar w="80%" />
            </div>
          ))}
        </div>
      </div>
      <Pulse delay={1.2} style={{ top: "3%", right: "3%", height: "7%", width: "13%" }} />
      <Modal title="Select an app type" delay={2}>
        {[
          ["Business", "Manage ads, Pages and business assets with the Marketing API."],
          ["Consumer", "Facebook Login and other consumer features."],
          ["Gaming", "Games on Facebook."],
        ].map(([t, d], i) => (
          <div
            key={t}
            style={flex(8, {
              ...box,
              marginBottom: 6,
              padding: 6,
              borderColor: i === 0 ? META_BLUE : LINE,
            })}
          >
            <span
              style={{
                width: 12,
                height: 12,
                flexShrink: 0,
                boxSizing: "border-box",
                borderRadius: 999,
                border: `1px solid ${i === 0 ? META_BLUE : "#ccd0d5"}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {i === 0 ? (
                <motion.span
                  style={{ width: 6, height: 6, borderRadius: 999, backgroundColor: META_BLUE }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 3.3 }}
                />
              ) : null}
            </span>
            <span>
              <span style={{ display: "block", fontWeight: 600 }}>{t}</span>
              <span style={{ ...soft, display: "block", fontSize: 9 }}>{d}</span>
            </span>
          </div>
        ))}
        <div style={{ marginTop: 8, textAlign: "right" }}>
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
      <div style={fill("24%")}>
        <div style={flex(0)}>
          <p style={bold(13)}>System users</p>
          <span style={{ marginLeft: "auto" }}>
            <PrimaryBtn>+ Add</PrimaryBtn>
          </span>
        </div>
        <p style={{ ...soft, margin: "4px 0 0" }}>
          System users act on behalf of your business through the API.
        </p>
      </div>
      <Pulse delay={1.1} style={{ top: "5%", right: "3.6%", height: "7%", width: "8.5%" }} />
      <Modal title="Create system user" delay={1.8}>
        <p style={{ ...soft, margin: "0 0 4px" }}>System username</p>
        <div style={{ ...box, marginBottom: 10, padding: "6px 8px" }}>
          <motion.span
            style={{
              display: "inline-block",
              overflow: "hidden",
              verticalAlign: "bottom",
              whiteSpace: "nowrap",
            }}
            initial={{ width: 0 }}
            animate={{ width: "auto" }}
            transition={{ delay: 2.4, duration: 0.8 }}
          >
            {BRAND.name}
          </motion.span>
        </div>
        <p style={{ ...soft, margin: "0 0 4px" }}>System user role</p>
        <div style={flex(0, { ...box, marginBottom: 12, padding: "6px 8px" })}>
          <Reveal delay={3.4} from={0}>
            <span style={{ fontWeight: 600 }}>Admin</span>
          </Reveal>
          <ChevronDown size={12} style={{ marginLeft: "auto" }} />
        </div>
        <div style={{ textAlign: "right" }}>
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
      <Modal title="Assign assets" delay={0.3} width="64%">
        <div style={{ display: "grid", gap: 4 }}>
          {rows.map((r) => (
            <div key={r.type} style={flex(8, { ...box, padding: "6px 8px" })}>
              <Tick delay={r.delay - 0.3} />
              <span style={{ flex: 1 }}>
                <span style={{ display: "block", fontWeight: 600 }}>{r.name}</span>
                <span style={{ ...soft, display: "block", fontSize: 9 }}>{r.type}</span>
              </span>
              <span style={soft}>Full control</span>
              <Toggle delay={r.delay} />
            </div>
          ))}
        </div>
        <div style={{ marginTop: 8, textAlign: "right" }}>
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
      <Modal title="Generate token" delay={0.3} width="62%">
        <div style={{ marginBottom: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <p style={{ ...soft, margin: "0 0 4px" }}>App</p>
            <div style={flex(0, { ...box, padding: "4px 8px" })}>
              <span style={{ fontWeight: 600 }}>{BRAND.name}</span>
              <ChevronDown size={12} style={{ marginLeft: "auto" }} />
            </div>
          </div>
          <div>
            <p style={{ ...soft, margin: "0 0 4px" }}>Token expiration</p>
            <div style={flex(0, { ...box, padding: "4px 8px", borderColor: META_BLUE })}>
              <span style={{ fontWeight: 600 }}>Never</span>
              <ChevronDown size={12} style={{ marginLeft: "auto" }} />
            </div>
          </div>
        </div>
        <p style={{ ...soft, margin: "0 0 4px" }}>Permissions</p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px" }}>
          {shown.map((p, i) => (
            <span
              key={p}
              className="rp-mono"
              style={flex(6, { fontSize: 9, minWidth: 0, overflow: "hidden" })}
            >
              <Tick delay={1.3 + i * 0.35} />
              {p}
            </span>
          ))}
        </div>
        <div style={{ marginTop: 10, textAlign: "right" }}>
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
        <p style={{ ...soft, margin: "0 0 8px" }}>
          Copy this token now. Meta won&apos;t show it again.
        </p>
        <div style={flex(8, { ...box, background: "#f0f2f5", padding: "6px 8px" })}>
          <span
            className="rp-mono"
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 9,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            EAAG•••••••••••••••••••••••••••••Zd3
          </span>
          <span
            style={flex(4, {
              display: "inline-flex",
              borderRadius: 5,
              border: "1px solid #ccd0d5",
              padding: "2px 6px",
              fontSize: 9,
              fontWeight: 600,
            })}
          >
            <Copy size={10} /> Copy
          </span>
        </div>
        <Reveal
          delay={2.1}
          from={4}
          style={flex(4, {
            display: "inline-flex",
            marginTop: 10,
            borderRadius: 999,
            background: "#e6f4ea",
            padding: "2px 8px",
            fontSize: 9,
            fontWeight: 600,
            color: "#1e8e3e",
          })}
        >
          <Check size={10} strokeWidth={3} /> Copied to clipboard
        </Reveal>
      </Modal>
      <Reveal
        delay={2.8}
        from={0}
        style={flex(8, {
          position: "absolute",
          right: "4%",
          bottom: "8%",
          zIndex: 20,
          borderRadius: 999,
          background: "#191917",
          padding: "6px 12px",
          fontSize: 11,
          fontWeight: 600,
          color: "#fff",
          boxShadow: "0 10px 15px -3px rgba(0,0,0,.2)",
        })}
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

import type { CSSProperties, ReactNode } from "react";

export type ArtKind =
  | "verify"
  | "syncing"
  | "drafting"
  | "invalid_key"
  | "api_disabled"
  | "no_permission"
  | "disconnected"
  | "quota"
  | "inbox_zero"
  | "reply_failed"
  | "step_sa"
  | "step_invite"
  | "step_ours"
  | "step_app";

const A = "#0F6B4A";
const L = "#D9D6CF";
const MONO = "var(--rp-mono)";
const SERIF = "var(--rp-serif)";
const SANS = "var(--rp-sans)";

const shadow = (a: number, b: number, o = 0.5) =>
  `0 ${a}px ${b}px -${Math.round(b * 0.55)}px rgba(25,25,23,${o})`;

function Check({ style }: { style?: CSSProperties }) {
  return (
    <span
      style={{
        position: "absolute",
        top: -7,
        right: -7,
        width: 18,
        height: 18,
        borderRadius: "50%",
        background: A,
        color: "#fff",
        fontFamily: SANS,
        fontStyle: "normal",
        fontSize: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      ✓
    </span>
  );
}

function Num({ n, style }: { n: number; style?: CSSProperties }) {
  return (
    <span
      style={{
        position: "absolute",
        top: -9,
        left: -9,
        width: 17,
        height: 17,
        borderRadius: "50%",
        background: A,
        color: "#fff",
        fontFamily: SANS,
        fontSize: 9.5,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      {n}
    </span>
  );
}

function Link({ on, dot }: { on: boolean; dot: boolean }) {
  return (
    <div
      style={{
        position: "relative",
        width: 40,
        height: 2,
        background: on ? A : L,
        transition: "background .3s",
      }}
    >
      {dot ? (
        <span
          style={{
            position: "absolute",
            top: -3,
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: A,
            animation: "sa-travel 1s linear infinite",
          }}
        />
      ) : null}
    </div>
  );
}

function Play({ color, size = 18 }: { color: string; size?: number }) {
  return (
    <span
      style={{
        width: 0,
        height: 0,
        borderLeft: `${size}px solid ${color}`,
        borderTop: `${Math.round(size * 0.61)}px solid transparent`,
        borderBottom: `${Math.round(size * 0.61)}px solid transparent`,
        marginLeft: 5,
      }}
    />
  );
}

function Bar({ w, bg = "#EFEDE8", h = 8 }: { w: string; bg?: string; h?: number }) {
  return (
    <span style={{ display: "block", height: h, width: w, borderRadius: 4, background: bg }} />
  );
}

function BrowserChrome({ url }: { url: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "9px 12px",
        borderBottom: "1px solid #EFEDE8",
      }}
    >
      {[0, 1, 2].map((i) => (
        <span key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#E6E4DF" }} />
      ))}
      <span style={{ marginLeft: 8, fontFamily: MONO, fontSize: 10, color: "#6C6962" }}>{url}</span>
    </div>
  );
}

function Pill({ children, dot }: { children: ReactNode; dot?: boolean }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 12px",
        borderRadius: 999,
        background: "#fff",
        border: "1px solid #E6E4DF",
        fontFamily: MONO,
        fontSize: 11.5,
        color: "#55534E",
      }}
    >
      {dot ? (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: A,
            animation: "sa-blink 1s ease-in-out infinite",
          }}
        />
      ) : null}
      <span>{children}</span>
    </div>
  );
}

const card: CSSProperties = {
  borderRadius: 14,
  background: "#fff",
  border: "1px solid #E6E4DF",
};

export function StateArt({
  kind,
  stage = 0,
  height = 300,
  caption,
  email,
  detail,
}: {
  kind: ArtKind;
  stage?: number;
  height?: number;
  caption?: string;
  email?: string;
  detail?: string;
}) {
  const s = stage;
  const sa = email ?? "replyly@your-project.iam.gserviceaccount.com";
  const shortSa = sa.length > 26 ? `${sa.slice(0, 24)}…` : sa;
  return (
    <div
      aria-hidden
      style={{
        position: "relative",
        width: "100%",
        height,
        minHeight: 180,
        borderRadius: 12,
        backgroundColor: "#F4F2EE",
        backgroundImage: "radial-gradient(#DCD8D0 1px, transparent 1px)",
        backgroundSize: "14px 14px",
        overflow: "hidden",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: SANS,
        color: "#191917",
      }}
    >
      {kind === "verify" ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                position: "relative",
                width: 58,
                height: 58,
                borderRadius: 16,
                background: "#fff",
                border: `1.5px solid ${A}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: MONO,
                fontSize: 15,
                boxShadow: "0 10px 24px -14px rgba(25,25,23,.4)",
              }}
            >
              <span>{"{ }"}</span>
              {s === 0 ? (
                <span
                  style={{
                    position: "absolute",
                    inset: -7,
                    borderRadius: 21,
                    border: `2px solid ${A}`,
                    animation: "sa-ring 1.4s ease-out infinite",
                  }}
                />
              ) : null}
              {s >= 1 ? <Check /> : null}
            </div>
            <Link on={s >= 2} dot={s === 1} />
            <div
              style={{
                position: "relative",
                width: 64,
                height: 64,
                borderRadius: 18,
                background: "#191917",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: SERIF,
                fontStyle: "italic",
                fontSize: 34,
                boxShadow: "0 14px 28px -14px rgba(25,25,23,.6)",
              }}
            >
              <span>r</span>
              {s >= 2 ? <Check /> : null}
            </div>
            <Link on={s >= 3} dot={s === 2} />
            <div
              style={{
                position: "relative",
                width: 58,
                height: 58,
                borderRadius: 16,
                background: "#fff",
                border: `1.5px solid ${s >= 3 ? A : "#E6E4DF"}`,
                opacity: s >= 2 ? 1 : 0.5,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 10px 24px -14px rgba(25,25,23,.4)",
                transition: "all .3s",
              }}
            >
              <Play color={A} />
              {s >= 3 ? <Check /> : null}
            </div>
          </div>
          <Pill dot>
            {caption ??
              [
                "reading key file…",
                "checking Play Developer API…",
                "checking Play Console access…",
                "connected",
              ][Math.min(s, 3)]}
          </Pill>
        </div>
      ) : null}

      {kind === "syncing" ? (
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 20,
            width: 250,
          }}
        >
          <div
            style={{
              position: "relative",
              display: "flex",
              gap: 14,
              padding: "14px 18px",
              ...card,
              borderRadius: 16,
              boxShadow: "0 12px 28px -18px rgba(25,25,23,.45)",
            }}
          >
            {["#E8590C", "#1C64B8", "#2F7D4F", "#6D4AD8"].map((c) => (
              <span key={c} style={{ width: 40, height: 40, borderRadius: 11, background: c }} />
            ))}
            <span
              style={{
                position: "absolute",
                top: -8,
                bottom: -8,
                width: 2,
                background: A,
                borderRadius: 2,
                boxShadow: "0 0 0 4px rgba(15,107,74,.12)",
                animation: "sa-scan 1.6s ease-in-out infinite alternate",
              }}
            />
          </div>
          <div
            style={{
              width: "100%",
              height: 6,
              borderRadius: 999,
              background: "#E6E4DF",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: "62%",
                height: "100%",
                borderRadius: 999,
                backgroundImage: "repeating-linear-gradient(45deg,#0F6B4A 0 7px,#2B8A66 7px 14px)",
                backgroundSize: "28px 100%",
                animation: "sa-stripes .8s linear infinite",
              }}
            />
          </div>
          <span style={{ fontFamily: MONO, fontSize: 11.5, color: "#55534E" }}>
            {caption ?? "pulling reviews…"}
          </span>
        </div>
      ) : null}

      {kind === "drafting" ? (
        <div
          style={{
            position: "relative",
            width: 230,
            padding: 16,
            ...card,
            boxShadow: "0 14px 30px -18px rgba(25,25,23,.45)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 11.5,
              color: A,
              fontWeight: 500,
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: "50%",
                border: "2px solid #CFE3D8",
                borderTopColor: A,
                animation: "sa-spin .8s linear infinite",
              }}
            />
            <span>Drafting reply</span>
          </div>
          {["100%", "88%", "64%"].map((w) => (
            <div
              key={w}
              style={{
                height: 9,
                width: w,
                borderRadius: 4,
                background: "linear-gradient(90deg,#EFEDE8 0,#E0EDE6 50%,#EFEDE8 100%)",
                backgroundSize: "240px 100%",
                animation: "sa-shimmer 1.3s linear infinite",
              }}
            />
          ))}
          <span
            style={{
              position: "absolute",
              right: -8,
              top: -12,
              padding: "4px 8px",
              borderRadius: 8,
              background: "#191917",
              color: "#fff",
              fontFamily: MONO,
              fontSize: 10.5,
              animation: "sa-float 2.4s ease-in-out infinite",
            }}
          >
            {"{user_name}"}
          </span>
        </div>
      ) : null}

      {kind === "invalid_key" ? (
        <div style={{ position: "relative" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: "translate(14px,10px) rotate(4deg)",
              borderRadius: 12,
              background: "#fff",
              border: "1px solid #E6E4DF",
              opacity: 0.6,
            }}
          />
          <div
            style={{
              position: "relative",
              width: 220,
              padding: "14px 16px",
              borderRadius: 12,
              background: "#fff",
              border: "1px solid #E6E4DF",
              transform: "rotate(-3deg)",
              boxShadow: shadow(16, 30),
              fontFamily: MONO,
              fontSize: 11,
              lineHeight: 1.75,
              color: "#55534E",
            }}
          >
            <div>{"{"}</div>
            <div style={{ paddingLeft: 12 }}>&quot;type&quot;: &quot;service_account&quot;,</div>
            <div style={{ paddingLeft: 12 }}>&quot;project_id&quot;: &quot;your-project&quot;,</div>
            <div style={{ paddingLeft: 12, display: "flex", gap: 6, alignItems: "center" }}>
              <span>&quot;client_email&quot;:</span>
              <span
                style={{
                  padding: "0 6px",
                  borderRadius: 4,
                  background: "#FDF0EE",
                  color: "#B42318",
                  textDecoration: "line-through",
                }}
              >
                missing
              </span>
            </div>
            <div style={{ paddingLeft: 12 }}>&quot;private_key&quot;: &quot;•••••&quot;</div>
            <div>{"}"}</div>
          </div>
          <span
            style={{
              position: "absolute",
              top: -14,
              right: -8,
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "#B42318",
              color: "#fff",
              fontWeight: 600,
              fontSize: 18,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 0 6px #F4F2EE",
              animation: "sa-shake 2.2s ease-in-out infinite",
            }}
          >
            !
          </span>
        </div>
      ) : null}

      {kind === "api_disabled" ? (
        <div
          style={{
            position: "relative",
            width: detail ? "auto" : 240,
            minWidth: 240,
            padding: 16,
            ...card,
            boxShadow: shadow(16, 30),
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: 8,
            }}
          >
            <span style={{ fontFamily: MONO, fontSize: 10.5, color: "#6C6962" }}>
              {detail ?? "androidpublisher.googleapis.com"}
            </span>
            <span
              style={{
                padding: "2px 7px",
                borderRadius: 999,
                background: "#FDF0EE",
                color: "#B42318",
                fontSize: 10.5,
                fontWeight: 500,
              }}
            >
              Disabled
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 13, fontWeight: 500, maxWidth: 160, lineHeight: 1.3 }}>
              {detail?.startsWith("playdeveloperreporting")
                ? "Google Play Developer Reporting API"
                : "Google Play Android Developer API"}
            </span>
            <span
              style={{
                width: 46,
                height: 26,
                borderRadius: 999,
                background: "#D3D0C9",
                padding: 3,
                boxSizing: "border-box",
                display: "flex",
              }}
            >
              <span
                style={{
                  width: 20,
                  height: 20,
                  borderRadius: "50%",
                  background: "#fff",
                  boxShadow: "0 1px 3px rgba(0,0,0,.25)",
                }}
              />
            </span>
          </div>
          <span
            style={{
              position: "absolute",
              right: 18,
              bottom: -22,
              fontSize: 28,
              color: "#191917",
              animation: "sa-float 1.8s ease-in-out infinite",
            }}
          >
            ↖
          </span>
        </div>
      ) : null}

      {kind === "no_permission" ? (
        <div
          style={{
            position: "relative",
            width: 230,
            padding: "14px 16px",
            ...card,
            boxShadow: shadow(16, 30),
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <span
            style={{
              fontSize: 11,
              color: "#6C6962",
              textTransform: "uppercase",
              letterSpacing: ".06em",
            }}
          >
            App permissions
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5 }}>
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                background: A,
                color: "#fff",
                fontSize: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              ✓
            </span>
            <span>View app information</span>
          </div>
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 12.5,
              padding: "6px 8px",
              margin: "0 -8px",
              borderRadius: 8,
              outline: "1.5px dashed #B42318",
              animation: "sa-blink 1.6s ease-in-out infinite",
            }}
          >
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                border: "1.5px solid #B42318",
                boxSizing: "border-box",
              }}
            />
            <span style={{ color: "#B42318", fontWeight: 500 }}>Reply to reviews</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              fontSize: 12.5,
              opacity: 0.45,
            }}
          >
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: 4,
                border: "1.5px solid #C9C5BC",
                boxSizing: "border-box",
              }}
            />
            <span>Manage store presence</span>
          </div>
          <span
            style={{
              position: "absolute",
              top: -18,
              right: -10,
              width: 44,
              height: 44,
              borderRadius: 13,
              background: "#191917",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 0 6px #F4F2EE",
              animation: "sa-float 2.6s ease-in-out infinite",
            }}
          >
            <span
              style={{
                position: "relative",
                width: 16,
                height: 12,
                borderRadius: 3,
                background: "#fff",
                marginTop: 6,
              }}
            >
              <span
                style={{
                  position: "absolute",
                  left: 3,
                  top: -8,
                  width: 10,
                  height: 10,
                  border: "2px solid #fff",
                  borderBottom: "none",
                  borderRadius: "6px 6px 0 0",
                  boxSizing: "border-box",
                }}
              />
            </span>
          </span>
        </div>
      ) : null}

      {kind === "disconnected" ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: 60,
                height: 60,
                borderRadius: 18,
                background: "#191917",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontFamily: SERIF,
                fontStyle: "italic",
                fontSize: 32,
              }}
            >
              r
            </div>
            <div style={{ width: 28, height: 2, background: "#191917" }} />
            <div
              style={{
                width: 10,
                height: 2,
                background: "#191917",
                transform: "rotate(-24deg)",
                animation: "sa-wobble 1.4s ease-in-out infinite",
              }}
            />
            <span
              style={{
                width: 30,
                height: 30,
                margin: "0 8px",
                borderRadius: "50%",
                background: "#B42318",
                color: "#fff",
                fontSize: 15,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 0 0 5px #F4F2EE",
              }}
            >
              ×
            </span>
            <div
              style={{ width: 10, height: 2, background: "#C9C5BC", transform: "rotate(24deg)" }}
            />
            <div style={{ width: 28, height: 0, borderTop: "2px dashed #C9C5BC" }} />
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: "#fff",
                border: "1.5px solid #E6E4DF",
                opacity: 0.55,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Play color="#6C6962" size={17} />
            </div>
          </div>
          <Pill>{caption ?? "connection lost"}</Pill>
        </div>
      ) : null}

      {kind === "quota" ? (
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <div
            style={{
              width: 170,
              padding: "14px 16px",
              ...card,
              boxShadow: shadow(16, 30),
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            <span
              style={{
                fontSize: 11,
                color: "#6C6962",
                textTransform: "uppercase",
                letterSpacing: ".06em",
              }}
            >
              Reply quota · today
            </span>
            <div
              style={{
                height: 10,
                borderRadius: 999,
                overflow: "hidden",
                backgroundImage: "repeating-linear-gradient(45deg,#B42318 0 6px,#D4523F 6px 12px)",
                backgroundSize: "28px 100%",
                animation: "sa-stripes 1.2s linear infinite",
              }}
            />
            <span style={{ fontFamily: MONO, fontSize: 12 }}>{caption ?? "2,000 / 2,000"}</span>
          </div>
          <div
            style={{
              position: "relative",
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: "#fff",
              border: "2px solid #191917",
              boxShadow: "0 12px 24px -14px rgba(25,25,23,.5)",
            }}
          >
            <span
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 2,
                height: 22,
                marginLeft: -1,
                background: "#191917",
                transformOrigin: "50% 0",
                animation: "sa-spin 4s linear infinite",
              }}
            />
            <span
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 2,
                height: 15,
                marginLeft: -1,
                background: "#B42318",
                transformOrigin: "50% 0",
                transform: "rotate(130deg)",
              }}
            />
            <span
              style={{
                position: "absolute",
                left: "50%",
                top: "50%",
                width: 6,
                height: 6,
                margin: "-3px 0 0 -3px",
                borderRadius: "50%",
                background: "#191917",
              }}
            />
          </div>
        </div>
      ) : null}

      {kind === "inbox_zero" ? (
        <div style={{ position: "relative", width: 220, height: 130 }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              ...card,
              transform: "rotate(-8deg) translate(-18px,6px)",
              opacity: 0.55,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              ...card,
              transform: "rotate(6deg) translate(16px,4px)",
              opacity: 0.75,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              ...card,
              boxShadow: "0 18px 34px -18px rgba(25,25,23,.5)",
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 9,
            }}
          >
            <span style={{ fontSize: 12, color: "#C9A227", letterSpacing: 1 }}>★★★★★</span>
            <Bar w="80%" />
            <Bar w="56%" />
            <span
              style={{
                display: "block",
                height: 8,
                width: "68%",
                borderRadius: 4,
                background: "#E0EDE6",
                marginTop: 6,
              }}
            />
          </div>
          <span
            style={{
              position: "absolute",
              right: -16,
              bottom: -14,
              width: 48,
              height: 48,
              borderRadius: "50%",
              background: A,
              color: "#fff",
              fontSize: 22,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              boxShadow: "0 0 0 6px #F4F2EE",
              animation: "sa-float 2.4s ease-in-out infinite",
            }}
          >
            ✓
          </span>
          <span
            style={{
              position: "absolute",
              left: -30,
              top: -8,
              width: 8,
              height: 8,
              borderRadius: "50%",
              background: "#E8590C",
              animation: "sa-float 2s ease-in-out infinite",
            }}
          />
          <span
            style={{
              position: "absolute",
              right: 10,
              top: -24,
              width: 6,
              height: 6,
              borderRadius: 2,
              background: "#6D4AD8",
              transform: "rotate(30deg)",
              animation: "sa-float 2.8s ease-in-out infinite",
            }}
          />
          <span
            style={{
              position: "absolute",
              left: 40,
              bottom: -28,
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#1C64B8",
              animation: "sa-float 2.2s ease-in-out infinite",
            }}
          />
        </div>
      ) : null}

      {kind === "reply_failed" ? (
        <div style={{ width: 240, display: "flex", flexDirection: "column", gap: 8 }}>
          <div
            style={{
              padding: "12px 14px",
              borderRadius: 12,
              background: "#fff",
              border: "1px solid #E6E4DF",
              display: "flex",
              flexDirection: "column",
              gap: 7,
            }}
          >
            <span style={{ fontSize: 11, color: "#C9A227", letterSpacing: 1 }}>★★☆☆☆</span>
            <Bar w="84%" h={7} />
            <Bar w="60%" h={7} />
          </div>
          <div
            style={{
              marginLeft: 28,
              padding: "12px 14px",
              borderRadius: 12,
              background: "#fff",
              border: "1.5px dashed #B42318",
              display: "flex",
              flexDirection: "column",
              gap: 7,
              boxShadow: "0 16px 30px -18px rgba(180,35,24,.45)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#6C6962" }}>Developer response</span>
              <span
                style={{
                  padding: "1px 7px",
                  borderRadius: 999,
                  background: "#FDF0EE",
                  color: "#B42318",
                  fontSize: 10.5,
                  fontWeight: 500,
                }}
              >
                Not posted
              </span>
            </div>
            <Bar w="90%" h={7} bg="#F6E3E0" />
            <Bar w="50%" h={7} bg="#F6E3E0" />
          </div>
        </div>
      ) : null}

      {kind === "step_sa" ? (
        <div
          style={{
            position: "relative",
            width: 280,
            borderRadius: 12,
            background: "#fff",
            border: "1px solid #E6E4DF",
            boxShadow: shadow(18, 36),
          }}
        >
          <BrowserChrome url="console.cloud.google.com/iam-admin" />
          <div style={{ display: "flex" }}>
            <div
              style={{
                width: 70,
                padding: "12px 10px",
                borderRight: "1px solid #EFEDE8",
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <Bar w="100%" h={6} />
              <Bar w="80%" h={6} />
              <Bar w="100%" h={6} bg="#191917" />
              <Bar w="70%" h={6} />
            </div>
            <div
              style={{
                flex: 1,
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 600 }}>Service accounts</span>
                <span
                  style={{
                    position: "relative",
                    padding: "4px 8px",
                    borderRadius: 6,
                    background: "#191917",
                    color: "#fff",
                    fontSize: 10,
                    boxShadow: "0 0 0 3px rgba(15,107,74,.25)",
                  }}
                >
                  + Create
                  <Num n={1} style={{ top: -10, left: -10 }} />
                </span>
              </div>
              <div
                style={{
                  padding: 8,
                  borderRadius: 6,
                  background: "#F7F6F3",
                  fontFamily: MONO,
                  fontSize: 9.5,
                  color: "#55534E",
                }}
              >
                {shortSa}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <span
                  style={{
                    padding: "3px 7px",
                    borderRadius: 5,
                    border: "1px solid #E6E4DF",
                    fontSize: 10,
                  }}
                >
                  Keys
                </span>
                <span
                  style={{
                    padding: "3px 7px",
                    borderRadius: 5,
                    border: "1px solid #E6E4DF",
                    fontSize: 10,
                  }}
                >
                  Add key → JSON
                </span>
              </div>
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              right: -8,
              bottom: -22,
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 10px",
              borderRadius: 10,
              background: "#191917",
              color: "#fff",
              fontFamily: MONO,
              fontSize: 10.5,
              boxShadow: "0 12px 24px -12px rgba(25,25,23,.6)",
              animation: "sa-float 2.6s ease-in-out infinite",
            }}
          >
            <span>↓</span>
            <span>replyly-key.json</span>
            <Num n={2} />
          </div>
        </div>
      ) : null}

      {kind === "step_invite" ? (
        <div
          style={{
            position: "relative",
            width: 280,
            borderRadius: 12,
            background: "#fff",
            border: "1px solid #E6E4DF",
            boxShadow: shadow(18, 36),
          }}
        >
          <BrowserChrome url="play.google.com/console/users" />
          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Invite user</span>
            <div
              style={{
                position: "relative",
                padding: 8,
                borderRadius: 6,
                border: `1.5px solid ${A}`,
                fontFamily: MONO,
                fontSize: 9.5,
                color: "#191917",
                overflowWrap: "break-word",
              }}
            >
              {sa}
              <span
                style={{
                  display: "inline-block",
                  width: 1,
                  height: 10,
                  background: "#191917",
                  marginLeft: 2,
                  verticalAlign: "middle",
                  animation: "sa-blink 1s steps(1) infinite",
                }}
              />
              <Num n={1} />
            </div>
            <div
              style={{
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: 7,
                padding: 10,
                borderRadius: 6,
                background: "#F7F6F3",
              }}
            >
              {["View app information", "Reply to reviews"].map((t) => (
                <div
                  key={t}
                  style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}
                >
                  <span
                    style={{
                      width: 13,
                      height: 13,
                      borderRadius: 3,
                      background: A,
                      color: "#fff",
                      fontSize: 8,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    ✓
                  </span>
                  {t}
                </div>
              ))}
              <Num n={2} />
            </div>
            <span
              style={{
                alignSelf: "flex-end",
                padding: "5px 10px",
                borderRadius: 6,
                background: "#191917",
                color: "#fff",
                fontSize: 10.5,
              }}
            >
              Invite user
            </span>
          </div>
        </div>
      ) : null}

      {kind === "step_ours" ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: 58,
                height: 58,
                borderRadius: 16,
                background: "#191917",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 10px 24px -14px rgba(25,25,23,.6)",
              }}
            >
              <svg viewBox="0 0 32 32" width="30" height="30">
                <path
                  d="M16 24V8.5M16 18.5l-5.5-5.5M16 15.5l5.5-5.5"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <Link on dot />
            <div
              style={{
                position: "relative",
                width: 200,
                padding: "12px 14px",
                ...card,
                boxShadow: shadow(18, 36),
                display: "flex",
                flexDirection: "column",
                gap: 8,
                animation: "sa-float 2.6s ease-in-out infinite",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    background: "#E7F1EC",
                    color: A,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 12,
                  }}
                >
                  <svg viewBox="0 0 16 16" width="12" height="12">
                    <circle
                      cx="5.5"
                      cy="8"
                      r="3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                    />
                    <path
                      d="M8.5 8H14M12 8v2.5M14 8v2"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                    />
                  </svg>
                </span>
                <span style={{ fontSize: 11.5, fontWeight: 600 }}>Service account</span>
              </div>
              <div
                style={{
                  padding: "6px 8px",
                  borderRadius: 6,
                  background: "#F7F6F3",
                  fontFamily: MONO,
                  fontSize: 9.5,
                  color: "#55534E",
                  overflowWrap: "anywhere",
                }}
              >
                {sa}
              </div>
              <Bar w="70%" h={6} />
              <Check />
            </div>
          </div>
          <Pill dot>made for your workspace · no key to download</Pill>
        </div>
      ) : null}

      {kind === "step_app" ? (
        <div
          style={{
            position: "relative",
            width: 280,
            borderRadius: 12,
            background: "#fff",
            border: "1px solid #E6E4DF",
            boxShadow: shadow(18, 36),
          }}
        >
          <BrowserChrome url="treevook · add app" />
          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: A,
                  color: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: SERIF,
                  fontSize: 17,
                  flexShrink: 0,
                }}
              >
                {(caption || "A").trim().charAt(0).toUpperCase() || "A"}
              </span>
              <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                <span
                  style={{
                    fontSize: 12.5,
                    fontWeight: 600,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {caption || "Your app"}
                </span>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 9.5,
                    color: "#6C6962",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {detail || "com.yourcompany.app"}
                </span>
              </span>
            </div>
            {[5, 4, 2].map((n, i) => (
              <div
                key={n}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 5,
                  padding: 8,
                  borderRadius: 6,
                  background: "#F7F6F3",
                  opacity: s > 0 ? 1 : 0.55 - i * 0.12,
                  transition: "opacity .3s",
                }}
              >
                <span style={{ fontSize: 9, color: n > 3 ? A : "#B42318", letterSpacing: 1 }}>
                  {"★".repeat(n)}
                  <span style={{ color: L }}>{"★".repeat(5 - n)}</span>
                </span>
                <Bar w={`${88 - i * 18}%`} h={5} />
              </div>
            ))}
          </div>
          <div style={{ position: "absolute", right: 12, bottom: -16 }}>
            <Pill dot>{s > 0 ? "syncing reviews" : "waiting for your app"}</Pill>
          </div>
        </div>
      ) : null}
    </div>
  );
}

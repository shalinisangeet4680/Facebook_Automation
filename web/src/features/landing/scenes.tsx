import {
  ArrowDown,
  Bookmark,
  Check,
  Clapperboard,
  GalleryHorizontalEnd,
  Heart,
  Lock,
  MessageCircle,
  MoonStar,
  PauseCircle,
  Send,
  Sparkles,
  ThumbsUp,
  TrendingUp,
} from "lucide-react";
import type { ReactNode } from "react";

export function Mark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
      <path
        d="M16 24V8.5M16 18.5l-5.5-5.5M16 15.5l5.5-5.5"
        fill="none"
        stroke="#fff"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function Typing({ label }: { label: string }) {
  return (
    <span className="tv-seq tv-seqTyping">
      <Sparkles size={12} /> {label}
      <span className="tv-dots">
        <i />
        <i />
        <i />
      </span>
    </span>
  );
}

function Done({ children }: { children: ReactNode }) {
  return (
    <span className="tv-seq tv-seqDone">
      <Check size={13} /> {children}
    </span>
  );
}

function MapsReview({
  initial,
  color,
  name,
  meta,
  stars,
  when,
  text,
  reply,
}: {
  initial: string;
  color: string;
  name: string;
  meta: string;
  stars: number;
  when: string;
  text: string;
  reply: string;
}) {
  return (
    <div className="tv-gm tv-seq tv-seqReview">
      <div className="tv-gmWho">
        <span className="tv-playAvatar" style={{ background: color }}>
          {initial}
        </span>
        <span style={{ display: "flex", flexDirection: "column" }}>
          <span className="tv-gmName">{name}</span>
          <span className="tv-gmSub">{meta}</span>
        </span>
      </div>
      <div className="tv-gmMeta">
        <span className="tv-gmStars">
          {"★★★★★".slice(0, stars)}
          <span>{"★★★★★".slice(stars)}</span>
        </span>
        {when}
      </div>
      <p className="tv-gmText">{text}</p>
      <div className="tv-seqSlot">
        <Typing label="TreeVook AI is replying" />
        <div className="tv-seq tv-seqReply tv-gmReply">
          <div className="tv-gmOwner">
            Response from the owner <span>Just now</span>
          </div>
          {reply}
        </div>
      </div>
    </div>
  );
}

function FbThread({
  name,
  comment,
  page,
  reply,
}: {
  name: string;
  comment: string;
  page: string;
  reply: string;
}) {
  return (
    <div className="tv-fb">
      <div className="tv-fbRow tv-seq tv-seqReview">
        <span className="tv-playAvatar" style={{ background: "#8E24AA" }}>
          {name[0]}
        </span>
        <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span className="tv-fbBubble">
            <b>{name}</b>
            {comment}
          </span>
          <span className="tv-fbActs">
            2m <b>Like</b> <b>Reply</b>
          </span>
        </span>
      </div>
      <div className="tv-seqSlot" style={{ marginLeft: 34 }}>
        <Typing label="AI is replying" />
        <div className="tv-fbRow tv-seq tv-seqReply">
          <span
            className="tv-playAvatar"
            style={{ background: "#2D5BD7", width: 20, height: 20, fontSize: 10 }}
          >
            {page[0]}
          </span>
          <span style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            <span className="tv-fbBubble">
              <b>
                {page} <i>Author</i>
              </b>
              {reply}
            </span>
            <span className="tv-fbActs">
              Just now <b>Like</b> <b>Reply</b>
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

function AdsTable() {
  return (
    <div className="tv-ads">
      <div className="tv-adsHead">
        <span>Ad</span>
        <span>Results</span>
        <span>Spent</span>
      </div>
      <div className="tv-adsRow">
        <span className="tv-switch tv-seq tv-seqSwitch">
          <i className="tv-seq tv-seqKnob" />
        </span>
        <span className="tv-adsName">
          Ad D<em className="tv-seq tv-seqReply">Paused by AI</em>
        </span>
        <span className="tv-mono">0</span>
        <span className="tv-mono">₹800</span>
      </div>
      <div className="tv-adsRow">
        <span className="tv-switch tv-on">
          <i />
        </span>
        <span className="tv-adsName">Ad B</span>
        <span className="tv-mono">24</span>
        <span className="tv-mono">₹790</span>
      </div>
      <div className="tv-seqSlot">
        <Typing label="Checking yesterday’s results" />
        <div className="tv-seq tv-seqDoneSlot tv-adsTip">
          <span>
            <b>Scale Ad B +25%?</b> Cost per lead −32%
          </span>
          <span className="tv-chipBtn">Approve</span>
        </div>
      </div>
    </div>
  );
}

function IgPost({ compact }: { compact?: boolean }) {
  return (
    <div className={compact ? "tv-igMini" : "tv-ig"}>
      <span className="tv-igHead">
        <span className="tv-ring">
          <span className="tv-avatar" style={{ width: 22, height: 22, fontSize: 10 }}>
            S
          </span>
        </span>
        <b>sharmadental</b>
      </span>
      <div className="tv-seqSlot tv-igMedia">
        <span className="tv-seq tv-seqTyping tv-igDesign">
          <Sparkles size={13} /> Designing
          <span className="tv-dots">
            <i />
            <i />
            <i />
          </span>
        </span>
        <div className="tv-seq tv-seqReply tv-igImg">
          <span className="tv-igText">
            Diwali
            <br />
            smile offer
          </span>
          <span className="tv-igBadge">20% off</span>
        </div>
      </div>
      {compact ? null : (
        <div className="tv-igActions">
          <Heart size={16} />
          <MessageCircle size={16} />
          <Send size={16} />
          <Bookmark size={16} style={{ marginLeft: "auto" }} />
        </div>
      )}
      <span className="tv-igCaption tv-seq tv-seqReply">
        <b>sharmadental</b> Light up your smile this Diwali ✨{" "}
        <span style={{ color: "#00376B" }}>#PatnaDentist</span>
      </span>
    </div>
  );
}

function GoogleUpdate() {
  return (
    <div className="tv-seqSlot">
      <Typing label="Writing your offer" />
      <div className="tv-gu tv-seq tv-seqReply">
        <span className="tv-gmSub">Sharma Dental Clinic · Offer</span>
        <b>Diwali smile offer</b>
        <span className="tv-gmSub">20 Oct – 31 Oct</span>
        <span className="tv-gmText">20% off teeth whitening this Diwali.</span>
        <span className="tv-guLink">Redeem online</span>
      </div>
    </div>
  );
}

const HUB = { x: 490, y: 465 };

const NODES = [
  { id: "g", side: "l", top: 0, color: "#0F6B4A" },
  { id: "ig", side: "l", top: 320, color: "#C2185B" },
  { id: "m", side: "l", top: 650, color: "#1C64B8" },
  { id: "p", side: "r", top: 0, color: "#E8590C" },
  { id: "fb", side: "r", top: 354, color: "#2D5BD7" },
  { id: "gp", side: "r", top: 657, color: "#0F6B4A" },
] as const;

const anchor = (n: (typeof NODES)[number]) => ({
  x: n.side === "l" ? 270 : 710,
  y: n.top + 42,
});

const wire = (n: (typeof NODES)[number]) => {
  const a = anchor(n);
  const bend = n.side === "l" ? -90 : 90;
  return `M ${HUB.x} ${HUB.y} C ${HUB.x + bend} ${HUB.y}, ${a.x - bend} ${a.y}, ${a.x} ${a.y}`;
};

function Node({
  node,
  label,
  title,
  delay = 0,
  children,
}: {
  node: (typeof NODES)[number];
  label: string;
  title: string;
  delay?: number;
  children: ReactNode;
}) {
  return (
    <div
      className={`tv-node tv-card tv-shadow tv-mini tv-d${delay}`}
      style={{ top: node.top, ...(node.side === "l" ? { left: 0 } : { right: 0 }) }}
    >
      <span
        className="tv-plug"
        style={{ background: node.color, ...(node.side === "l" ? { right: -5 } : { left: -5 }) }}
      />
      <div className="tv-miniHead">
        <span className="tv-eyebrowDot" style={{ background: node.color }} />
        {label}
      </div>
      <span className="tv-nodeTitle">{title}</span>
      {children}
    </div>
  );
}

export function HeroStage() {
  const [g, ig, m, p, fb, gp] = NODES;
  return (
    <div className="tv-stage" aria-hidden>
      <svg className="tv-wires" viewBox="0 0 980 930">
        {NODES.map((n) => (
          <path key={n.id} id={`wire-${n.id}`} className="tv-wire" d={wire(n)} />
        ))}
        {NODES.map((n, i) => (
          <circle key={n.id} className="tv-pulse" r="4" fill={n.color}>
            <animateMotion
              dur="2.8s"
              begin={`${i * 0.45}s`}
              repeatCount="indefinite"
              keyPoints="1;0"
              keyTimes="0;1"
              calcMode="linear"
              path={wire(n)}
            />
          </circle>
        ))}
      </svg>
      <div className="tv-hub">
        <Mark size={52} />
      </div>
      <Node node={g} label="Google Business" title="Auto-reply to Google reviews" delay={1}>
        <MapsReview
          initial="P"
          color="#0B8043"
          name="Priya Singh"
          meta="Local Guide · 23 reviews"
          stars={5}
          when="a week ago"
          text="Lovely staff and a very clean clinic."
          reply="Thank you Priya! We’re so glad you felt at home."
        />
        <Done>Live on Google Maps</Done>
      </Node>
      <Node node={ig} label="Instagram Autopost" title="AI designs and posts for you" delay={3}>
        <IgPost compact />
        <Done>Scheduled · Thu 7 PM, best time</Done>
      </Node>
      <Node node={m} label="Meta Ads" title="Daily ad check-up" delay={5}>
        <AdsTable />
      </Node>
      <Node node={p} label="Play Reviews" title="Auto-reply to app reviews">
        <div className="tv-play tv-seq tv-seqReview">
          <div className="tv-playWho">
            <span className="tv-playAvatar">R</span>
            <span>Rahul Verma</span>
          </div>
          <div className="tv-playMeta">
            <span className="tv-playStars">
              ★<span>★★★★</span>
            </span>
            24 July 2026
          </div>
          <p className="tv-playText">Can’t log in with Google, it keeps buffering</p>
          <div className="tv-playHelpful">
            Did you find this helpful?
            <span>Yes</span>
            <span>No</span>
          </div>
          <div className="tv-seqSlot">
            <Typing label="TreeVook AI is replying" />
            <div className="tv-seq tv-seqReply tv-playReply">
              <div className="tv-playDev">
                <span>Notes Pro</span>
                <span>Just now</span>
              </div>
              Sorry Rahul! Google login is fixed in v3.4, please update.
            </div>
          </div>
        </div>
        <Done>Live on Google Play</Done>
      </Node>
      <Node node={fb} label="Facebook Autopost" title="Auto-reply to comments" delay={2}>
        <FbThread
          name="Rohit Kumar"
          comment="What time does the camp start?"
          page="Sharma Dental"
          reply="9 AM to 1 PM at Fraser Road. See you!"
        />
        <Done>Replied on Facebook</Done>
      </Node>
      <Node node={gp} label="Google Business" title="Post offers on Google" delay={4}>
        <GoogleUpdate />
        <Done>Live on Google</Done>
      </Node>
    </div>
  );
}

export function BusinessScene() {
  return (
    <div className={"tv-scene"} style={{ background: "#EAF3EE" }} aria-hidden>
      <div className={"tv-sceneGrid"}>
        <div className="tv-card tv-shadow tv-pos tv-sceneCard">
          <span className="tv-nodeTitle">Auto-reply to Google reviews</span>
          <MapsReview
            initial="A"
            color="#E37400"
            name="Ankit Kumar"
            meta="4 reviews · 2 photos"
            stars={4}
            when="2 days ago"
            text="Good treatment, but I waited 40 minutes."
            reply="Thanks Ankit, and sorry about the wait. We’ve added evening slots so it won’t happen again."
          />
          <Done>Live on Google Maps</Done>
        </div>
        <div className={"tv-pair"}>
          <div
            className={`tv-card tv-shadow`}
            style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}
          >
            <span className={"tv-tiny"}>Post · scheduled</span>
            <span className={"tv-name"}>Free check-up camp</span>
            <span
              className={"tv-tag"}
              style={{ background: "#ECF2FB", color: "#1C64B8", alignSelf: "flex-start" }}
            >
              Sun 9:00 AM
            </span>
          </div>
          <div
            className={`tv-card tv-shadow`}
            style={{ padding: 14, display: "flex", flexDirection: "column", gap: 6 }}
          >
            <span className={"tv-row"}>
              <span className={"tv-tiny"}>Calls this month</span>
              <TrendingUp size={14} color="#0F6B4A" />
            </span>
            <span className={"tv-big"}>301</span>
            <div className={"tv-bars"}>
              {[30, 45, 38, 52, 47, 60, 72].map((h, i) => (
                <span key={i} style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PlayScene() {
  return (
    <div className={"tv-scene"} style={{ background: "#FDF1E9" }} aria-hidden>
      <div className={"tv-playLayout"}>
        <div className={"tv-phone"}>
          <div className="tv-phoneIn tv-phonePlay">
            <div className="tv-appRow">
              <span className="tv-appIcon">N</span>
              <span style={{ display: "flex", flexDirection: "column" }}>
                <span className="tv-name">Notes Pro</span>
                <span className="tv-tiny">Ratings and reviews</span>
              </span>
            </div>
            <div className="tv-seq tv-seqReview tv-phoneReview">
              <div className="tv-playWho">
                <span className="tv-playAvatar" style={{ background: "#7B1FA2" }}>
                  म
                </span>
                <span>मीना शर्मा</span>
              </div>
              <div className="tv-playMeta">
                <span className="tv-playStars">
                  ★★<span>★★★</span>
                </span>
                16 Oct 2026
              </div>
              <p className="tv-playText">लॉगिन के बाद ऐप बंद हो जाता है</p>
              <div className="tv-playHelpful">
                Did you find this helpful?
                <span>Yes</span>
                <span>No</span>
              </div>
              <div className="tv-seqSlot">
                <span className="tv-seq tv-seqTyping">
                  <Sparkles size={12} /> Replying in Hindi
                  <span className="tv-dots">
                    <i />
                    <i />
                    <i />
                  </span>
                </span>
                <div className="tv-seq tv-seqReply tv-playReply">
                  <div className="tv-playDev">
                    <span>Notes Pro</span>
                    <span>Just now</span>
                  </div>
                  माफ़ कीजिए मीना! v3.4 में यह ठीक हो गया है, कृपया अपडेट करें।
                </div>
              </div>
            </div>
            <span className="tv-seq tv-seqDone">
              <Check size={13} /> Live on Google Play
            </span>
          </div>
        </div>
        <div className={"tv-playSide"}>
          <div className={`tv-card tv-shadow`} style={{ padding: "6px 14px" }}>
            <div className={"tv-rules"}>
              {[
                [5, "Auto"],
                [4, "Auto"],
                [3, "Approval"],
                [1, "Approval"],
              ].map(([n, mode]) => (
                <div key={n} className={"tv-rule"}>
                  <span className={"tv-stars"}>{"★".repeat(Number(n))}</span>
                  <span
                    className="tv-tag"
                    style={
                      mode === "Auto"
                        ? { background: "#EAF3EE", color: "#0F6B4A" }
                        : { background: "#FBF3E2", color: "#8A5A00" }
                    }
                  >
                    {mode === "Auto" ? "Auto-reply" : "Waits for you"}
                  </span>
                </div>
              ))}
            </div>
          </div>
          <div
            className={`tv-card tv-shadow`}
            style={{ padding: 14, display: "flex", flexDirection: "column", gap: 6 }}
          >
            <span className={"tv-row"}>
              <span className={"tv-tiny"}>Rating today</span>
              <span className={"tv-tag"} style={{ background: "#FBF3E2", color: "#8A5A00" }}>
                Safety pause on
              </span>
            </span>
            <svg className={"tv-spark"} viewBox="0 0 200 46" preserveAspectRatio="none">
              <path
                d="M0 12 L40 10 L80 13 L120 11 L150 14 L175 30 L200 36"
                fill="none"
                stroke="#E8590C"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className={"tv-tiny"}>4.6 → 3.9 in a day, so auto-replies wait for you.</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MetaScene() {
  return (
    <div className={"tv-scene"} style={{ background: "#ECF2FB" }} aria-hidden>
      <div className={"tv-sceneGrid"}>
        <div className={`tv-card tv-shadow tv-plan tv-pos`}>
          <span className={"tv-step"}>1</span>
          <span className={"tv-row"}>
            <span className={"tv-name"}>Campaign plan · Leads</span>
            <span className={`tv-tag tv-mono`} style={{ background: "#EFEDE8" }}>
              ₹1,000/day
            </span>
          </span>
          <div className={"tv-why"}>
            <span>Patna, 25 km</span>
            <span>Women 25–45</span>
            <span>Reels + Feed</span>
            <span>6 ad variants</span>
          </div>
          <span className={"tv-tiny"}>
            Why: most past leads came from mobile Reels within 25 km.
          </span>
          <span className={"tv-row"}>
            <span className={"tv-tiny"}>Nothing spends until you say so</span>
            <span className={"tv-chipBtn"}>
              <Check size={13} /> Launch
            </span>
          </span>
        </div>
        <div className={"tv-flowArrow"}>
          <ArrowDown size={16} />
        </div>
        <div className="tv-card tv-shadow tv-pos tv-sceneCard">
          <span className="tv-step">2</span>
          <span className="tv-nodeTitle">Every morning at 7:30</span>
          <AdsTable />
        </div>
      </div>
    </div>
  );
}

export function ClaudeScene() {
  return (
    <div className={"tv-chat"} aria-hidden>
      <div className={"tv-bubbleMe"}>
        Reply to this week’s 1-star reviews and post our Diwali offer.
      </div>
      <div className={"tv-bubbleAi"}>
        I drafted 4 replies and an offer post for Sharma Dental Clinic. Post them now?
        <div className={"tv-confirm"}>
          <span className={"tv-chipBtn"}>
            <Check size={13} /> Yes, post
          </span>
          <span className={"tv-chipQuiet"}>Show me first</span>
        </div>
      </div>
    </div>
  );
}

export function ReleasesScene() {
  return (
    <div className={"tv-scene"} style={{ background: "#F1EDFC", minHeight: 320 }} aria-hidden>
      <div className={`tv-card tv-shadow tv-rollout`}>
        <span className={"tv-row"}>
          <span className={"tv-name"}>v3.5 rollout</span>
          <span className={"tv-tag"} style={{ background: "#FDF0EE", color: "#B42318" }}>
            <PauseCircle size={12} /> Auto-paused
          </span>
        </span>
        <div className={"tv-track"}>
          <span style={{ width: "20%", background: "#6D4AD8" }} />
        </div>
        <div className={"tv-ticks"}>
          <span>1%</span>
          <span>5%</span>
          <span>20%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
        <span className={"tv-tiny"}>
          Crash rate jumped to 2.1% on Android 14, so the rollout stopped at 20%.
        </span>
        <div className={"tv-draft"} style={{ background: "#F1EDFC", color: "#3B2A7A" }}>
          <div className={"tv-draftLabel"} style={{ color: "#6D4AD8" }}>
            <Sparkles size={12} /> Likely cause
          </div>
          LoginActivity.kt:88 reads a null token after the update.
        </div>
      </div>
    </div>
  );
}

export function ApproveArt() {
  return (
    <div className={"tv-seg"} style={{ fontSize: 13 }}>
      <span>Auto</span>
      <span className={"tv-segOn"}>Approval</span>
      <span>Manual</span>
    </div>
  );
}

export function GuardArt() {
  return (
    <div style={{ display: "flex", gap: 10 }}>
      <span
        className={"tv-tag"}
        style={{ background: "#fff", border: "1px solid #E6E4DF", padding: "6px 10px" }}
      >
        <MoonStar size={13} /> Quiet 10pm–8am
      </span>
      <span
        className={`tv-tag tv-mono`}
        style={{ background: "#fff", border: "1px solid #E6E4DF", padding: "6px 10px" }}
      >
        50/day max
      </span>
    </div>
  );
}

export function LockArt() {
  return (
    <span
      style={{
        width: 56,
        height: 56,
        borderRadius: 16,
        background: "#191917",
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Lock size={24} />
    </span>
  );
}

const WEEK = [
  { d: "Mon", bg: "linear-gradient(135deg,#F9D4E4,#E9C8F5)", kind: "post", ok: true },
  { d: "Tue", bg: "linear-gradient(135deg,#FFE3C2,#FBC7A8)", kind: "reel", ok: true },
  { d: "Wed", bg: "linear-gradient(135deg,#D6E8FF,#C9D7FB)", kind: "carousel", ok: false },
  { d: "Thu", bg: "linear-gradient(135deg,#FDE7A6,#F7C873)", kind: "post", ok: true },
  { d: "Fri", bg: "linear-gradient(135deg,#D7F0E2,#B9E2CC)", kind: "story", ok: true },
  { d: "Sat", bg: "linear-gradient(135deg,#F5D0D0,#EFB8C8)", kind: "reel", ok: false },
  { d: "Sun", bg: "linear-gradient(135deg,#E6E1F7,#D3CBF2)", kind: "post", ok: true },
] as const;

function KindIcon({ kind }: { kind: (typeof WEEK)[number]["kind"] }) {
  if (kind === "reel") return <Clapperboard size={12} />;
  if (kind === "carousel") return <GalleryHorizontalEnd size={12} />;
  if (kind === "story")
    return (
      <span
        style={{ width: 11, height: 11, borderRadius: "50%", border: "1.6px dashed currentColor" }}
      />
    );
  return null;
}

export function InstagramScene() {
  return (
    <div className="tv-scene" style={{ background: "#FBEFF6" }} aria-hidden>
      <div className="tv-sceneGrid" style={{ maxWidth: 500 }}>
        <div
          className="tv-card tv-shadow tv-pos"
          style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}
        >
          <span className="tv-step">1</span>
          <span className="tv-row">
            <span className="tv-name">This week · planned by AI</span>
            <span className="tv-tag" style={{ background: "#EAF3EE", color: "#0F6B4A" }}>
              <Sparkles size={12} /> 7 posts
            </span>
          </span>
          <div className="tv-week">
            {WEEK.map((w) => (
              <span key={w.d} className="tv-day">
                <span className="tv-tiny">{w.d}</span>
                <span className="tv-thumb" style={{ background: w.bg }}>
                  <KindIcon kind={w.kind} />
                </span>
                <span className="tv-dot" style={{ background: w.ok ? "#0F6B4A" : "#C9A227" }} />
              </span>
            ))}
          </div>
          <span className="tv-tiny">
            <span style={{ color: "#0F6B4A" }}>●</span> auto-post ·{" "}
            <span style={{ color: "#C9A227" }}>●</span> waits for your OK
          </span>
        </div>
        <div className="tv-split">
          <div className="tv-pos" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="tv-step">2</span>
            <IgPost />
            <Done>Scheduled · Thu 7 PM</Done>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div
              className="tv-card tv-shadow"
              style={{ padding: 12, display: "flex", flexDirection: "column", gap: 4 }}
            >
              <span className="tv-tiny">Scheduled</span>
              <span className="tv-name">Thu, 7:00 PM</span>
              <span
                className="tv-tag"
                style={{ background: "#F1EDFC", color: "#6D4AD8", alignSelf: "flex-start" }}
              >
                Best time
              </span>
            </div>
            <div
              className="tv-card tv-shadow"
              style={{ padding: 12, display: "flex", flexDirection: "column", gap: 4 }}
            >
              <span className="tv-row">
                <span className="tv-tiny">Reach</span>
                <TrendingUp size={14} color="#0F6B4A" />
              </span>
              <span className="tv-big">4.2k</span>
              <span className="tv-tiny" style={{ color: "#0F6B4A" }}>
                +38% this week
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function FacebookScene() {
  return (
    <div className="tv-scene" style={{ background: "#EEF2FD" }} aria-hidden>
      <div className="tv-sceneGrid">
        <div className="tv-card tv-shadow tv-pos" style={{ overflow: "visible" }}>
          <span className="tv-step">1</span>
          <div className="tv-who" style={{ padding: "12px 14px 8px" }}>
            <span className="tv-avatar" style={{ background: "#2D5BD7", color: "#fff" }}>
              S
            </span>
            <span style={{ display: "flex", flexDirection: "column" }}>
              <span className="tv-name">Sharma Dental Clinic</span>
              <span className="tv-tiny">Posted by AI · Sun 9:00 AM</span>
            </span>
          </div>
          <span className="tv-quote" style={{ padding: "0 14px 10px", display: "block" }}>
            Free dental check-up camp this Sunday 🦷 Bring the family!
          </span>
          <div className="tv-fbImg">
            <span>Free check-up camp</span>
          </div>
          <div className="tv-row" style={{ padding: "8px 14px", fontSize: 12, color: "#6C6962" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <ThumbsUp size={13} color="#2D5BD7" /> 128
            </span>
            <span>14 comments · 9 shares</span>
          </div>
        </div>
        <div className="tv-flowArrow">
          <ArrowDown size={16} />
        </div>
        <div className="tv-card tv-shadow tv-pos tv-sceneCard">
          <span className="tv-step">2</span>
          <span className="tv-nodeTitle">Auto-reply to comments</span>
          <FbThread
            name="Rohit Kumar"
            comment="What time does it start?"
            page="Sharma Dental Clinic"
            reply="Hi Rohit! 9 AM to 1 PM at Fraser Road. See you there 😊"
          />
          <Done>Replied on Facebook</Done>
        </div>
      </div>
    </div>
  );
}

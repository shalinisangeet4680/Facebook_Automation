import { ArrowDown, Check, Lock, MoonStar, PauseCircle, Sparkles, TrendingUp } from "lucide-react";

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

function Review({
  initial,
  name,
  stars,
  text,
}: {
  initial: string;
  name: string;
  stars: number;
  text: string;
}) {
  return (
    <>
      <div className={"tv-who"}>
        <span className={"tv-avatar"}>{initial}</span>
        <span style={{ display: "flex", flexDirection: "column" }}>
          <span className={"tv-name"}>{name}</span>
          <span className={"tv-stars"}>
            {"★★★★★".slice(0, stars)}
            <span style={{ color: "#D9D5CC" }}>{"★★★★★".slice(stars)}</span>
          </span>
        </span>
      </div>
      <span className={"tv-quote"}>{text}</span>
    </>
  );
}

export function HeroStage() {
  return (
    <div className={"tv-stage"} aria-hidden>
      <svg className={"tv-wires"} viewBox="0 0 980 440" preserveAspectRatio="none">
        <path className={"tv-wire"} d="M490 220 C 380 220, 330 110, 250 100" />
        <path className={"tv-wire"} d="M490 220 C 600 220, 650 110, 740 96" />
        <path className={"tv-wire"} d="M490 220 C 380 230, 330 330, 250 345" />
        <path className={"tv-wire"} d="M490 220 C 600 230, 650 330, 740 350" />
      </svg>
      <div className={"tv-hub"}>
        <Mark size={52} />
      </div>
      <div className={`tv-float tv-card tv-shadow tv-mini`} style={{ left: 0, top: 10 }}>
        <div className={"tv-miniHead"}>
          <span className={"tv-eyebrowDot"} style={{ background: "#0F6B4A" }} />
          Google review
        </div>
        <Review initial="P" name="Priya S." stars={5} text="Lovely staff, very clean clinic." />
        <div className={"tv-draft"}>
          <div className={"tv-draftLabel"}>
            <Sparkles size={12} /> AI draft
          </div>
          Thank you Priya! We’re so glad you felt at home.
        </div>
        <div className={"tv-row"}>
          <span className={"tv-chipQuiet"}>Edit</span>
          <span className={"tv-chipBtn"}>
            <Check size={13} /> Approve
          </span>
        </div>
      </div>
      <div className={`tv-float tv-card tv-shadow tv-mini`} style={{ right: 0, top: 0 }}>
        <div className={"tv-miniHead"}>
          <span className={"tv-eyebrowDot"} style={{ background: "#E8590C" }} />
          Play Store review
        </div>
        <Review initial="R" name="Rahul V." stars={1} text="App crashes after login 😞" />
        <div className={"tv-row"}>
          <span className={"tv-tag"} style={{ background: "#FDF0EE", color: "#B42318" }}>
            Login issue
          </span>
          <span className={"tv-tag"} style={{ background: "#EAF3EE", color: "#0F6B4A" }}>
            <Check size={12} /> Replied in Hindi
          </span>
        </div>
      </div>
      <div className={`tv-float tv-card tv-shadow tv-mini`} style={{ left: 30, bottom: 0 }}>
        <div className={"tv-miniHead"}>
          <span className={"tv-eyebrowDot"} style={{ background: "#1C64B8" }} />
          Meta ads · daily check
        </div>
        <div className={"tv-row"}>
          <span style={{ display: "flex", flexDirection: "column" }}>
            <span className={"tv-name"}>Ad D paused</span>
            <span className={"tv-tiny"}>₹800 spent · 0 leads</span>
          </span>
          <PauseCircle size={22} color="#B42318" />
        </div>
        <div className={"tv-row"}>
          <span style={{ display: "flex", flexDirection: "column" }}>
            <span className={"tv-name"}>Scale Ad B +25%?</span>
            <span className={"tv-tiny"}>Cost per lead −32%</span>
          </span>
          <span className={"tv-chipBtn"}>Approve</span>
        </div>
      </div>
      <div className={`tv-float tv-card tv-shadow tv-mini`} style={{ right: 20, bottom: 10 }}>
        <div className={"tv-miniHead"}>
          <span className={"tv-eyebrowDot"} style={{ background: "#0F6B4A" }} />
          Google post · scheduled
        </div>
        <div className={"tv-row"}>
          <span style={{ display: "flex", flexDirection: "column" }}>
            <span className={"tv-name"}>Diwali smile offer</span>
            <span className={"tv-tiny"}>Goes live Fri, 10:00 AM</span>
          </span>
          <span
            className={`tv-tag tv-mono`}
            style={{ border: "1px dashed #0F6B4A", color: "#0F6B4A" }}
          >
            SMILE20
          </span>
        </div>
      </div>
    </div>
  );
}

export function BusinessScene() {
  return (
    <div className={"tv-scene"} style={{ background: "#EAF3EE" }} aria-hidden>
      <div className={"tv-sceneGrid"}>
        <div
          className={`tv-card tv-shadow tv-pos`}
          style={{ padding: 14, display: "flex", flexDirection: "column", gap: 8 }}
        >
          <span className={"tv-step"}>1</span>
          <Review
            initial="A"
            name="Ankit K. on Google"
            stars={4}
            text="Good treatment, but I waited 40 minutes."
          />
        </div>
        <div className={"tv-flowArrow"}>
          <ArrowDown size={16} />
        </div>
        <div
          className={`tv-card tv-shadow tv-pos`}
          style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}
        >
          <span className={"tv-step"}>2</span>
          <div className={"tv-draft"}>
            <div className={"tv-draftLabel"}>
              <Sparkles size={12} /> AI draft · in your voice
            </div>
            Thanks Ankit, and sorry about the wait. We’ve added evening slots so it won’t happen
            again.
          </div>
          <div className={"tv-row"}>
            <span className={"tv-tiny"}>You approve, it posts</span>
            <span className={"tv-chipBtn"}>
              <Check size={13} /> Approve
            </span>
          </div>
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
          <div className={"tv-phoneIn"}>
            <div className={"tv-appRow"}>
              <span className={"tv-appIcon"}>N</span>
              <span style={{ display: "flex", flexDirection: "column" }}>
                <span className={"tv-name"}>Notes Pro</span>
                <span className={"tv-tiny"}>Ratings and reviews</span>
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <Review initial="म" name="Meena" stars={2} text="लॉगिन के बाद ऐप बंद हो जाता है" />
            </div>
            <div className={"tv-draft"} style={{ fontSize: 12 }}>
              <div className={"tv-draftLabel"}>Developer reply</div>
              माफ़ कीजिए मीना! v3.4 में यह ठीक हो गया है, कृपया अपडेट करें।
            </div>
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
        <div
          className={`tv-card tv-shadow tv-pos`}
          style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}
        >
          <span className={"tv-step"}>2</span>
          <span className={"tv-tiny"}>Every morning at 7:30</span>
          {[
            ["#B42318", "Paused Ad D", "₹800 spent, no leads", "Done"],
            ["#0F6B4A", "Scale Ad B by 25%", "Cost per lead down 32%", "Approve"],
          ].map(([color, title, sub, action]) => (
            <div key={title} className={"tv-row"}>
              <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <span
                  className={"tv-adThumb"}
                  style={{ background: `linear-gradient(135deg, ${color}22, ${color}55)` }}
                />
                <span style={{ display: "flex", flexDirection: "column" }}>
                  <span className={"tv-name"}>{title}</span>
                  <span className={"tv-tiny"}>{sub}</span>
                </span>
              </span>
              <span className={action === "Done" ? "tv-chipQuiet" : "tv-chipBtn"}>{action}</span>
            </div>
          ))}
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

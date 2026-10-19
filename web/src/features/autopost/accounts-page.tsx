"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  type AutopostAccount,
  type AutopostCommentClass,
  type AutopostContentType,
  type AutopostSettings,
  type PostMode,
  type SocialPlatform,
  useAutopostAccount,
  useAutopostStatus,
  useRemoveAutopostAccount,
  useResumeAutopostAccount,
  useStartAutopostSignIn,
  useSyncAutopostAccount,
  useUpdateAutopostAccount,
} from "@/lib/api/autopost";
import { errorMessage } from "@/lib/api/errors";
import { FacebookMark } from "@/features/meta/facebook-mark";
import { ago, rowBorder } from "@/features/replyly/tokens";
import {
  Banner,
  PageHead,
  Section,
  Seg,
  SettingRow,
  Skel,
  Spinner,
  Toggle,
  useToast,
} from "@/features/replyly/ui";

import { MUTED, Pill } from "./common";
import { BestTimeGrid } from "./insights-page";
import {
  CLASS_LABEL,
  CONTENT_LABEL,
  CONTENT_TYPES,
  FORMAT_LABEL,
  PLATFORMS,
  fmtNum,
} from "./platform";
import { useSocialAccounts } from "./shell";

const MODE_OPTIONS = [
  { id: "auto" as const, label: "Auto" },
  { id: "approval" as const, label: "Approval" },
  { id: "manual" as const, label: "Manual" },
];

function InstagramMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id="ig-mark" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#F58529" />
          <stop offset=".5" stopColor="#DD2A7B" />
          <stop offset="1" stopColor="#8134AF" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="20" height="20" rx="6" fill="url(#ig-mark)" />
      <circle cx="12" cy="12" r="4.2" fill="none" stroke="#fff" strokeWidth="1.8" />
      <circle cx="17.2" cy="6.8" r="1.2" fill="#fff" />
    </svg>
  );
}

function Settings({ account }: { account: AutopostAccount }) {
  const toast = useToast();
  const detail = useAutopostAccount(account.id);
  const update = useUpdateAutopostAccount(account.id);
  const s = detail.data?.settings;
  if (!s || !detail.data) return <Skel h={200} />;
  const save = (patch: Parameters<typeof update.mutate>[0], ok = "Saved") =>
    update.mutate(patch, {
      onSuccess: () => toast(ok),
      onError: (err) => toast(errorMessage(err)),
    });
  const formats = PLATFORMS[account.platform].formats;
  const number = (
    label: string,
    value: number,
    key: "dailyLimit" | "weeklyLimit" | "postsPerWeek",
    max: number,
  ) => (
    <input
      type="number"
      className="rp-input"
      aria-label={label}
      min={key === "postsPerWeek" ? 1 : 0}
      max={max}
      defaultValue={value}
      style={{ width: 90 }}
      onBlur={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n) && n !== value) save({ [key]: n });
      }}
    />
  );
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, padding: "4px 16px 18px" }}>
      <Section
        title="Post modes"
        desc="What happens with each type of post the weekly plan creates."
      >
        <div className="rp-card">
          {CONTENT_TYPES.map((t: AutopostContentType, i) => (
            <SettingRow key={t} first={i === 0} label={CONTENT_LABEL[t]}>
              <Seg
                label={`${CONTENT_LABEL[t]} mode`}
                value={s.modes[t]}
                small
                onChange={(v: PostMode) => save({ modes: { [t]: v } }, `${CONTENT_LABEL[t]}: ${v}`)}
                options={MODE_OPTIONS}
              />
            </SettingRow>
          ))}
        </div>
      </Section>
      <Section title="Weekly plan">
        <div className="rp-card">
          <SettingRow
            first
            label="Plan every Sunday"
            desc="A new week of posts lands in the calendar each Sunday."
          >
            <Toggle
              label="Plan every Sunday"
              on={s.weeklyPlan}
              onChange={() => save({ weeklyPlan: !s.weeklyPlan })}
            />
          </SettingRow>
          <SettingRow label="Posts per week">
            {number("Posts per week", s.postsPerWeek, "postsPerWeek", 14)}
          </SettingRow>
          <SettingRow label="Formats in the plan">
            <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {formats.map((f) => {
                const on = s.formats.includes(f);
                return (
                  <button
                    key={f}
                    type="button"
                    className="rp-chip"
                    aria-pressed={on}
                    style={
                      on
                        ? { background: "#191917", color: "#fff", borderColor: "#191917" }
                        : undefined
                    }
                    onClick={() =>
                      save({ formats: on ? s.formats.filter((x) => x !== f) : [...s.formats, f] })
                    }
                  >
                    {FORMAT_LABEL[f]}
                  </button>
                );
              })}
            </span>
          </SettingRow>
        </div>
      </Section>
      <Section
        title="Safeguards"
        desc="Automatic posts and replies stop and wait for you when one of these trips."
      >
        <div className="rp-card">
          <SettingRow first label="Automatic posts per day">
            {number("Posts per day", s.dailyLimit, "dailyLimit", 25)}
          </SettingRow>
          <SettingRow label="Automatic posts per week">
            {number("Posts per week limit", s.weeklyLimit, "weeklyLimit", 100)}
          </SettingRow>
          <SettingRow
            label="Quiet hours"
            desc={
              s.quietHours
                ? `Nothing goes out between ${s.quietHours.start} and ${s.quietHours.end} (${s.timezone}).`
                : "Off"
            }
          >
            <Toggle
              label="Quiet hours"
              on={Boolean(s.quietHours)}
              onChange={() =>
                save({ quietHours: s.quietHours ? null : { start: "22:00", end: "08:00" } })
              }
            />
          </SettingRow>
          <SettingRow
            label="Safety pause"
            desc="Pause automatic posts and replies for 3 days if engagement drops sharply or a post is reported."
          >
            <Toggle
              label="Safety pause"
              on={s.autoPause}
              onChange={() => save({ autoPause: !s.autoPause })}
            />
          </SettingRow>
          <SettingRow
            label="Never-auto words"
            desc="Posts and replies that mention these always wait for approval."
          >
            <input
              className="rp-input"
              aria-label="Never-auto words"
              defaultValue={s.neverAutoWords.join(", ")}
              style={{ minWidth: 240, flex: "1 1 240px" }}
              onBlur={(e) => {
                const next = e.target.value
                  .split(",")
                  .map((w) => w.trim())
                  .filter(Boolean);
                if (next.join(",") !== s.neverAutoWords.join(",")) save({ neverAutoWords: next });
              }}
            />
          </SettingRow>
        </div>
      </Section>
      <CommentSettings s={s} save={save} platform={account.platform} />
      <Section title="Best time to post">
        <div className="rp-card" style={{ padding: 16 }}>
          <BestTimeGrid times={detail.data.bestTimes} />
        </div>
      </Section>
    </div>
  );
}

function CommentSettings({
  s,
  save,
  platform,
}: {
  s: AutopostSettings;
  save: (
    patch: Parameters<ReturnType<typeof useUpdateAutopostAccount>["mutate"]>[0],
    ok?: string,
  ) => void;
  platform: SocialPlatform;
}) {
  const classes: AutopostCommentClass[] = ["question", "praise", "complaint", "other"];
  return (
    <Section
      title="Comment replies"
      desc="AI drafts replies in your voice. Choose what goes out on its own."
    >
      <div className="rp-card">
        {classes.map((c, i) => (
          <SettingRow key={c} first={i === 0} label={CLASS_LABEL[c]}>
            <Seg
              label={`${CLASS_LABEL[c]} replies`}
              value={s.comments.modes[c]}
              small
              onChange={(v: PostMode) => save({ comments: { modes: { [c]: v } } })}
              options={MODE_OPTIONS}
            />
          </SettingRow>
        ))}
        <SettingRow label="Voice">
          <Seg
            label="Reply voice"
            value={s.comments.tone}
            small
            onChange={(v) => save({ comments: { tone: v } })}
            options={[
              { id: "friendly", label: "Friendly" },
              { id: "professional", label: "Professional" },
              { id: "concise", label: "Concise" },
            ]}
          />
        </SettingRow>
        {platform === "facebook" ? (
          <SettingRow
            label="Hide spam"
            desc="Links, follower offers and scams are hidden from your Page."
          >
            <Toggle
              label="Hide spam"
              on={s.comments.hideSpam}
              onChange={() => save({ comments: { hideSpam: !s.comments.hideSpam } })}
            />
          </SettingRow>
        ) : null}
        <SettingRow
          label="Send complaints to Slack"
          desc="Uses the Slack webhook from your workspace automation settings."
        >
          <Toggle
            label="Send complaints to Slack"
            on={s.comments.escalateComplaints}
            onChange={() =>
              save({ comments: { escalateComplaints: !s.comments.escalateComplaints } })
            }
          />
        </SettingRow>
      </div>
    </Section>
  );
}

function AccountRow({
  account,
  i,
  color,
  onReconnect,
}: {
  account: AutopostAccount;
  i: number;
  color: string;
  onReconnect: () => void;
}) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const sync = useSyncAutopostAccount();
  const remove = useRemoveAutopostAccount();
  const resume = useResumeAutopostAccount();
  const [now] = useState(() => Date.now());
  const paused = account.pausedUntil && Date.parse(account.pausedUntil) > now;
  return (
    <div style={{ borderTop: rowBorder(i) }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          padding: "14px 16px",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: color,
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontWeight: 600,
          }}
        >
          {account.name.charAt(0).toUpperCase()}
        </span>
        <span style={{ display: "flex", flexDirection: "column", gap: 2, flex: 1, minWidth: 200 }}>
          <span
            style={{
              fontWeight: 500,
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            {account.username ? `@${account.username}` : account.name}
            {account.status === "error" ? (
              <Pill bg="#FDF0EE" fg="#B42318">
                Reconnect needed
              </Pill>
            ) : paused ? (
              <Pill bg="#FBF3E2" fg="#8A5A00">
                Paused
              </Pill>
            ) : null}
          </span>
          <span style={{ fontSize: 12, color: account.status === "error" ? "#B42318" : MUTED }}>
            {account.status === "error"
              ? account.error
              : `${fmtNum(account.followers)} followers · via ${account.login === "facebook" ? "Facebook" : "Instagram"} sign-in${account.username && account.name ? ` · ${account.name}` : ""}${account.commentsSyncedAt ? ` · synced ${ago(account.commentsSyncedAt)}` : ""}`}
          </span>
        </span>
        <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {account.status === "error" ? (
            <button
              type="button"
              className="rp-btn"
              style={{ padding: "7px 12px" }}
              onClick={onReconnect}
            >
              Reconnect
            </button>
          ) : (
            <button
              type="button"
              className="rp-btn-light"
              style={{ padding: "7px 12px" }}
              disabled={sync.isPending}
              onClick={() =>
                sync.mutate(account.id, {
                  onSuccess: (r) =>
                    toast(`${r.comments.created} new comments · ${r.metrics.posts} posts measured`),
                  onError: (err) => toast(errorMessage(err)),
                })
              }
            >
              {sync.isPending ? <Spinner size={11} dark /> : null}
              Sync now
            </button>
          )}
          <button
            type="button"
            className="rp-btn-light"
            style={{ padding: "7px 12px" }}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? "Close settings" : "Settings"}
          </button>
          <button
            type="button"
            className="rp-btn-quiet"
            style={{ padding: "7px 12px" }}
            disabled={remove.isPending}
            onClick={() => {
              if (
                window.confirm(
                  `Remove ${account.username ? `@${account.username}` : account.name}? Its posts, comments and insights are removed from TreeVook. Nothing changes on ${account.platform === "instagram" ? "Instagram" : "Facebook"}.`,
                )
              )
                remove.mutate(account.id, {
                  onSuccess: () => toast("Removed"),
                  onError: (err) => toast(errorMessage(err)),
                });
            }}
          >
            Remove
          </button>
        </span>
      </div>
      {paused ? (
        <div style={{ padding: "0 16px 14px" }}>
          <Banner
            tone="warn"
            title="Safety pause"
            action={
              <button
                type="button"
                className="rp-btn-light"
                style={{ padding: "7px 12px" }}
                disabled={resume.isPending}
                onClick={() =>
                  resume.mutate(account.id, { onSuccess: () => toast("Automation resumed") })
                }
              >
                Resume now
              </button>
            }
          >
            {account.pauseReason}
          </Banner>
        </div>
      ) : null}
      {open ? <Settings account={account} /> : null}
    </div>
  );
}

export function AccountsPage({ platform }: { platform: SocialPlatform }) {
  const toast = useToast();
  const params = useSearchParams();
  const error = params.get("error");
  const connected = params.get("connected");
  const info = PLATFORMS[platform];
  const status = useAutopostStatus();
  const { accounts, loading, color } = useSocialAccounts(platform);
  const start = useStartAutopostSignIn();
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    if (connected !== null)
      toast(
        Number(connected)
          ? `Connected ${connected} new account${connected === "1" ? "" : "s"}`
          : "Accounts are up to date",
      );
  }, [connected, toast]);

  function signIn(login: "facebook" | "instagram") {
    start.mutate(
      { login, product: platform },
      {
        onSuccess: ({ url }) => {
          setLeaving(true);
          window.location.assign(url);
        },
        onError: (err) => toast(errorMessage(err)),
      },
    );
  }

  const buttons = (
    <span style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      <button
        type="button"
        className="rp-btn"
        style={{ padding: "10px 16px", gap: 10 }}
        disabled={start.isPending || leaving || status.data?.facebookLogin === false}
        onClick={() => signIn("facebook")}
      >
        {start.isPending || leaving ? <Spinner size={12} /> : <FacebookMark />}
        Continue with Facebook
      </button>
      {platform === "instagram" ? (
        <button
          type="button"
          className="rp-btn-light"
          style={{ padding: "10px 16px", gap: 10 }}
          disabled={start.isPending || leaving || status.data?.instagramLogin === false}
          onClick={() => signIn("instagram")}
        >
          <InstagramMark />
          Continue with Instagram
        </button>
      ) : null}
      {status.data?.facebookLogin === false &&
      (platform === "facebook" || status.data?.instagramLogin === false) ? (
        <span style={{ fontSize: 12, color: MUTED, flexBasis: "100%" }}>
          Meta sign-in isn’t set up on this server yet.
        </span>
      ) : null}
    </span>
  );

  return (
    <div
      className="rp-in"
      style={{ display: "flex", flexDirection: "column", gap: 22, maxWidth: 920 }}
    >
      <PageHead
        title="Accounts"
        sub={
          platform === "instagram"
            ? "Instagram professional accounts TreeVook posts to. Sign in with Facebook for accounts linked to a Page, or with Instagram for the rest."
            : "Facebook Pages TreeVook posts to and answers comments on."
        }
      />
      {error ? (
        <Banner tone="error" title="Sign-in didn’t finish">
          {error}
        </Banner>
      ) : null}
      {status.data?.mock ? (
        <Banner tone="info" title="Demo mode">
          Meta hasn’t approved TreeVook’s app yet, so signing in connects sample Pages and Instagram
          accounts with posts, comments and insights. Everything works the same way once Meta
          approves access.
        </Banner>
      ) : null}
      {loading ? (
        <Skel h={120} />
      ) : accounts.length ? (
        <div className="rp-card" style={{ display: "flex", flexDirection: "column" }}>
          {accounts.map((a, i) => (
            <AccountRow
              key={a.id}
              account={a}
              i={i}
              color={color(a.id)}
              onReconnect={() => signIn(a.login)}
            />
          ))}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              padding: "14px 16px",
              borderTop: "1px solid #EFEDE8",
            }}
          >
            {buttons}
          </div>
        </div>
      ) : (
        <div
          className="rp-card"
          style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
              gap: 14,
            }}
          >
            {[
              ["Weekly calendar", "AI plans tips, offers and festival posts at your best times."],
              ["Posts in your voice", "Captions, hashtags and brand images from your brand kit."],
              ["You stay in control", "Auto, approval or manual for every type of post."],
              ["Comment replies", "Questions answered, complaints sent to you, spam handled."],
            ].map(([t, d]) => (
              <span key={t} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <span style={{ fontWeight: 500, fontSize: 13.5, color: info.color }}>{t}</span>
                <span style={{ fontSize: 12.5, color: MUTED }}>{d}</span>
              </span>
            ))}
          </div>
          {buttons}
          <span style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>
            TreeVook asks Meta for permission to publish, read comments and insights for the
            accounts you choose. Your sign-in is encrypted, and nothing is posted without your rules
            or your approval.
          </span>
        </div>
      )}
    </div>
  );
}

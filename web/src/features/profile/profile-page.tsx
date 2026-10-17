"use client";

import {
  Camera,
  Check,
  CircleAlert,
  CircleDashed,
  Copy,
  Download,
  ExternalLink,
  ImagePlus,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";
import Image from "next/image";
import { useState, type CSSProperties, type ReactNode } from "react";

import { RpDialogClose, RpDialogContent, RpDialogRoot } from "@/features/replyly/dialog";
import { Banner, PageHead, Skel, Spinner, copyText, useToast } from "@/features/replyly/ui";
import { errorMessage } from "@/lib/api/errors";
import {
  useApplyFacebookProfile,
  useCreatives,
  useProfile,
  useSaveProfileDraft,
} from "@/lib/api/queries";
import type { FacebookPart, ProfileCheckup } from "@/lib/api/types";

const PROMPT =
  "Set up my Facebook Page and Instagram profile. Run the profile checkup, read my website, write a Page description and an Instagram bio, design a logo and a Facebook cover, and save it all as a profile draft for me to review.";

const PART_LABELS: Record<FacebookPart, string> = {
  about: "Short description",
  description: "Long description",
  website: "Website",
  phone: "Phone",
  email: "Email",
  picture: "Profile picture",
  cover: "Cover photo",
};

const MUTED = "#6C6962";
const SOFT = "#55534E";
const LINE = "1px solid #EFEDE8";

const FILL: CSSProperties = {
  width: "100%",
  height: "100%",
  objectFit: "cover",
  display: "block",
};

const TEXTAREA: CSSProperties = {
  width: "100%",
  resize: "vertical",
  lineHeight: 1.5,
  fontSize: 13,
};

type CheckItem = NonNullable<ProfileCheckup["facebook"]>["checks"][number];
type Img = { id: string; name: string; url: string } | null;

function src(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.pathname.startsWith("/media/") ? parsed.pathname : url;
  } catch {
    return url;
  }
}

function Pic({ url, alt, contain }: { url: string; alt: string; contain?: boolean }) {
  return (
    <Image
      unoptimized
      src={url}
      alt={alt}
      width={720}
      height={720}
      style={{ ...FILL, objectFit: contain ? "contain" : "cover" }}
    />
  );
}

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      className="rp-btn-light"
      style={{ padding: "6px 11px", fontSize: 12.5 }}
      onClick={async () => {
        if (await copyText(value)) {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        }
      }}
    >
      {copied ? <Check size={14} color="#0F6B4A" /> : <Copy size={14} />}
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </button>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="rp-field">
      <span className="rp-label">{label}</span>
      {children}
      {hint ? <span style={{ fontSize: 12, color: MUTED }}>{hint}</span> : null}
    </label>
  );
}

function Panel({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return (
    <div className="rp-card" style={{ minWidth: 0, overflow: "hidden", ...style }}>
      {children}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <Panel style={{ padding: 24, fontSize: 13.5, color: MUTED, lineHeight: 1.5 }}>{children}</Panel>
  );
}

export function ProfilePage() {
  const profile = useProfile();
  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHead
        title="Page & Instagram"
        sub="Complete your Facebook Page and Instagram profile so people trust your ads. Claude can write and design everything; you review and apply."
        actions={
          <button
            type="button"
            className="rp-btn-light"
            disabled={profile.isFetching}
            onClick={() => void profile.refetch()}
          >
            {profile.isFetching && !profile.isPending ? <Spinner /> : <RefreshCw size={14} />}
            Recheck
          </button>
        }
      />
      <div
        className="rp-card"
        style={{
          padding: 18,
          display: "flex",
          gap: 14,
          alignItems: "flex-start",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: 999,
            flexShrink: 0,
            background: "#EAF3EE",
            color: "#0F6B4A",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Sparkles size={18} aria-hidden />
        </span>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
            flex: "1 1 240px",
            minWidth: 0,
          }}
        >
          <span style={{ fontWeight: 600, fontSize: 15 }}>Let Claude prepare it</span>
          <span
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "#F7F6F3",
              border: "1px solid #EFEDE8",
              fontSize: 13,
              color: SOFT,
              lineHeight: 1.5,
            }}
          >
            {PROMPT}
          </span>
        </div>
        <CopyButton value={PROMPT} label="Copy prompt" />
      </div>
      {profile.isPending ? (
        <div style={GRID}>
          <Skel h={420} r={14} />
          <Skel h={420} r={14} />
        </div>
      ) : profile.isError ? (
        <Banner
          tone="error"
          title="Couldn’t run the profile checkup"
          action={
            <button type="button" className="rp-btn-light" onClick={() => void profile.refetch()}>
              Try again
            </button>
          }
        >
          {errorMessage(profile.error)}
        </Banner>
      ) : (
        <div style={GRID}>
          <FacebookCard key={JSON.stringify(profile.data.draft.facebook)} data={profile.data} />
          <InstagramCard key={JSON.stringify(profile.data.draft.instagram)} data={profile.data} />
        </div>
      )}
    </div>
  );
}

const GRID: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(340px, 100%), 1fr))",
  gap: 20,
  alignItems: "start",
};

function scoreTone(score: number) {
  if (score === 100) return { bg: "#EAF3EE", fg: "#0F6B4A" };
  if (score >= 50) return { bg: "#FBF3E2", fg: "#8A5A00" };
  return { bg: "#FDF0EE", fg: "#B42318" };
}

function Checklist({ checks, score }: { checks: CheckItem[]; score: number }) {
  const tone = scoreTone(score);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div
        style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}
      >
        <span style={{ fontWeight: 600, fontSize: 13.5 }}>Checklist</span>
        <span
          style={{
            padding: "2px 8px",
            borderRadius: 999,
            fontSize: 11.5,
            fontWeight: 500,
            background: tone.bg,
            color: tone.fg,
          }}
        >
          {score}% complete
        </span>
      </div>
      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 8,
        }}
      >
        {checks.map((c) => (
          <li key={c.key} style={{ display: "flex", gap: 10, fontSize: 13, lineHeight: 1.45 }}>
            <span style={{ flexShrink: 0, marginTop: 1, display: "flex" }}>
              {c.status === "done" ? (
                <Check size={16} color="#0F6B4A" aria-label="Done" />
              ) : c.status === "weak" ? (
                <CircleAlert size={16} color="#8A5A00" aria-label="Could be better" />
              ) : (
                <CircleDashed size={16} color="#A8A49B" aria-label="Missing" />
              )}
            </span>
            <span>
              <span style={{ fontWeight: 500 }}>{c.label}</span>
              {c.status !== "done" ? <span style={{ color: MUTED }}> · {c.hint}</span> : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ImageChoice({
  label,
  hint,
  image,
  onChange,
}: {
  label: string;
  hint: string;
  image: Img;
  onChange: (image: Img) => void;
}) {
  const [open, setOpen] = useState(false);
  const creatives = useCreatives();
  const images = creatives.data?.data.filter((c) => c.kind !== "video") ?? [];
  return (
    <div
      role="group"
      aria-label={label}
      style={{ display: "flex", flexDirection: "column", gap: 6 }}
    >
      <span className="rp-label">{label}</span>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: 8,
          borderRadius: 10,
          border: "1px solid #E6E4DF",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 8,
            flexShrink: 0,
            overflow: "hidden",
            background: "#F7F6F3",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {image ? (
            <Pic url={src(image.url)!} alt="" />
          ) : (
            <ImagePlus size={18} color="#A8A49B" aria-hidden />
          )}
        </div>
        <span
          style={{
            flex: "1 1 120px",
            minWidth: 0,
            fontSize: 12.5,
            color: MUTED,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {image ? image.name : hint}
        </span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {image ? (
            <button type="button" className="rp-btn-quiet" onClick={() => onChange(null)}>
              Remove
            </button>
          ) : null}
          <button
            type="button"
            className="rp-btn-light"
            style={{ padding: "6px 11px", fontSize: 12.5 }}
            onClick={() => setOpen(true)}
          >
            Choose
          </button>
        </div>
      </div>
      <RpDialogRoot open={open} onOpenChange={setOpen}>
        <RpDialogContent
          title={`Choose ${label.toLowerCase()}`}
          description="From your Creatives library."
          width={640}
        >
          {!images.length ? (
            <p
              style={{
                margin: 0,
                padding: "20px 0",
                textAlign: "center",
                fontSize: 13,
                color: MUTED,
              }}
            >
              No images yet. Upload one in Creatives or ask Claude to design it.
            </p>
          ) : (
            <ul
              style={{
                listStyle: "none",
                margin: 0,
                padding: 0,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
                gap: 10,
              }}
            >
              {images.map((c) => {
                const on = image?.id === c.id;
                return (
                  <li key={c.id} style={{ minWidth: 0 }}>
                    <button
                      type="button"
                      aria-pressed={on}
                      onClick={() => {
                        onChange({ id: c.id, name: c.name, url: c.url });
                        setOpen(false);
                      }}
                      style={{
                        width: "100%",
                        padding: 0,
                        textAlign: "left",
                        background: "#fff",
                        cursor: "pointer",
                        borderRadius: 10,
                        overflow: "hidden",
                        border: on ? "1.5px solid #0F6B4A" : "1px solid #E6E4DF",
                        boxShadow: on ? "0 0 0 2px #EAF3EE" : "none",
                        display: "flex",
                        flexDirection: "column",
                      }}
                    >
                      <span
                        style={{ aspectRatio: "1 / 1", background: "#F7F6F3", display: "block" }}
                      >
                        <Pic url={src(c.url)!} alt="" contain />
                      </span>
                      <span
                        style={{
                          padding: "6px 8px",
                          fontSize: 12,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {c.name} · {c.width}×{c.height}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </RpDialogContent>
      </RpDialogRoot>
    </div>
  );
}

function SubHead({ children }: { children: ReactNode }) {
  return <span style={{ fontWeight: 600, fontSize: 14 }}>{children}</span>;
}

function FacebookCard({ data }: { data: ProfileCheckup }) {
  const fb = data.facebook;
  const draft = data.draft.facebook;
  const save = useSaveProfileDraft();
  const apply = useApplyFacebookProfile();
  const toast = useToast();
  const [about, setAbout] = useState(draft.about ?? "");
  const [description, setDescription] = useState(draft.description ?? "");
  const [website, setWebsite] = useState(draft.website ?? "");
  const [phone, setPhone] = useState(draft.phone ?? "");
  const [email, setEmail] = useState(draft.email ?? "");
  const [picture, setPicture] = useState<Img>(draft.picture);
  const [cover, setCover] = useState<Img>(draft.cover);
  const [applyOpen, setApplyOpen] = useState(false);
  const [parts, setParts] = useState<FacebookPart[]>([]);

  if (!fb) {
    return <Empty>Select a Facebook Page in Setup to manage its profile.</Empty>;
  }

  const drafted: Record<FacebookPart, boolean> = {
    about: Boolean(draft.about),
    description: Boolean(draft.description),
    website: Boolean(draft.website),
    phone: Boolean(draft.phone),
    email: Boolean(draft.email),
    picture: Boolean(draft.picture),
    cover: Boolean(draft.cover),
  };
  const available = (Object.keys(drafted) as FacebookPart[]).filter((p) => drafted[p]);

  const saveDraft = () =>
    save.mutate(
      {
        facebook: {
          about: about.trim() || null,
          description: description.trim() || null,
          website: website.trim() || null,
          phone: phone.trim() || null,
          email: email.trim() || null,
          pictureCreativeId: picture?.id ?? null,
          coverCreativeId: cover?.id ?? null,
        },
        instagram: {
          name: data.draft.instagram.name,
          bio: data.draft.instagram.bio,
          website: data.draft.instagram.website,
          pictureCreativeId: data.draft.instagram.picture?.id ?? null,
        },
      },
      {
        onSuccess: () => toast("Facebook draft saved"),
        onError: (err) => toast(errorMessage(err)),
      },
    );

  const coverUrl = src(cover?.url ?? fb.profile.coverUrl);
  const pictureUrl = src(
    picture?.url ?? (fb.profile.pictureIsDefault ? null : fb.profile.pictureUrl),
  );

  return (
    <Panel>
      <div style={{ position: "relative", aspectRatio: "1640 / 624", background: "#F7F6F3" }}>
        {coverUrl ? (
          <Pic url={coverUrl} alt="Cover" />
        ) : (
          <span
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 13,
              color: MUTED,
            }}
          >
            No cover photo
          </span>
        )}
        {cover && cover.url !== fb.profile.coverUrl ? (
          <span
            style={{
              position: "absolute",
              top: 8,
              right: 8,
              padding: "2px 8px",
              borderRadius: 999,
              fontSize: 11.5,
              fontWeight: 500,
              background: "#EAF3EE",
              color: "#0F6B4A",
            }}
          >
            Draft
          </span>
        ) : null}
      </div>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
        <div
          style={{ marginTop: -56, display: "flex", alignItems: "flex-end", gap: 12, minWidth: 0 }}
        >
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 999,
              border: "4px solid #fff",
              background: "#F7F6F3",
              overflow: "hidden",
              flexShrink: 0,
              position: "relative",
            }}
          >
            {pictureUrl ? <Pic url={pictureUrl} alt="Profile" /> : null}
          </div>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              minWidth: 0,
              paddingBottom: 4,
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontWeight: 600,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              <Users size={15} aria-hidden /> {fb.profile.name}
            </span>
            {fb.profile.link ? (
              <a
                href={fb.profile.link}
                target="_blank"
                rel="noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 12.5,
                  color: "#0F6B4A",
                }}
              >
                Open Page <ExternalLink size={12} aria-hidden />
              </a>
            ) : null}
          </div>
        </div>

        <Checklist checks={fb.checks} score={fb.score} />

        <div
          style={{
            borderTop: LINE,
            paddingTop: 20,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <SubHead>Proposed changes</SubHead>
          <ImageChoice
            label="Profile picture"
            hint="Square logo, 720 × 720"
            image={picture}
            onChange={setPicture}
          />
          <ImageChoice
            label="Cover photo"
            hint="Banner, 1640 × 624"
            image={cover}
            onChange={setCover}
          />
          <Field label="Short description" hint={`${about.length}/255 · shown on your Page`}>
            <textarea
              className="rp-input rp-textarea"
              rows={3}
              maxLength={255}
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              style={TEXTAREA}
            />
          </Field>
          <Field label="Long description" hint="Optional, for the About section.">
            <textarea
              className="rp-input rp-textarea"
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={TEXTAREA}
            />
          </Field>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 180px", minWidth: 0, display: "flex" }}>
              <Field label="Website">
                <input
                  className="rp-input"
                  type="url"
                  placeholder="https://"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </Field>
            </div>
            <div style={{ flex: "1 1 180px", minWidth: 0, display: "flex" }}>
              <Field label="Phone">
                <input
                  className="rp-input"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
            </div>
          </div>
          <Field label="Email">
            <input
              className="rp-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="rp-btn-light"
              disabled={save.isPending}
              onClick={saveDraft}
            >
              {save.isPending ? <Spinner /> : null}
              Save draft
            </button>
            <button
              type="button"
              className="rp-btn"
              disabled={!available.length}
              onClick={() => {
                setParts(available);
                setApplyOpen(true);
              }}
            >
              Apply to Page
            </button>
          </div>
        </div>
      </div>

      <RpDialogRoot open={applyOpen} onOpenChange={setApplyOpen}>
        <RpDialogContent
          title="Update your Facebook Page?"
          description="Visitors see these changes right away. Save the draft first if you edited anything."
        >
          <fieldset
            style={{
              border: "1px solid #E6E4DF",
              borderRadius: 10,
              margin: 0,
              padding: 0,
              overflow: "hidden",
            }}
          >
            <legend
              style={{
                position: "absolute",
                width: 1,
                height: 1,
                overflow: "hidden",
                clip: "rect(0 0 0 0)",
              }}
            >
              What to update
            </legend>
            {available.map((part, i) => (
              <label
                key={part}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  fontSize: 13.5,
                  cursor: "pointer",
                  borderTop: i ? LINE : "none",
                }}
              >
                <input
                  type="checkbox"
                  style={{ width: 16, height: 16, accentColor: "#0F6B4A", margin: 0 }}
                  checked={parts.includes(part)}
                  onChange={() =>
                    setParts((cur) =>
                      cur.includes(part) ? cur.filter((x) => x !== part) : [...cur, part],
                    )
                  }
                />
                {PART_LABELS[part]}
              </label>
            ))}
          </fieldset>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <RpDialogClose className="rp-btn-light">Cancel</RpDialogClose>
            <button
              type="button"
              className="rp-btn"
              disabled={!parts.length || apply.isPending}
              onClick={() =>
                apply.mutate(parts, {
                  onSuccess: ({ results }) => {
                    setApplyOpen(false);
                    const failed = results.filter((r) => !r.ok);
                    if (!failed.length) toast("Page updated");
                    else
                      toast(
                        `Updated ${results.length - failed.length} of ${results.length}. ${failed.map((f) => `${PART_LABELS[f.part]}: ${f.error}`).join(" ")}`,
                      );
                  },
                  onError: (err) => toast(errorMessage(err)),
                })
              }
            >
              {apply.isPending ? <Spinner /> : null}
              Update Page
            </button>
          </div>
        </RpDialogContent>
      </RpDialogRoot>
    </Panel>
  );
}

function InstagramCard({ data }: { data: ProfileCheckup }) {
  const ig = data.instagram;
  const draft = data.draft.instagram;
  const save = useSaveProfileDraft();
  const toast = useToast();
  const [name, setName] = useState(draft.name ?? "");
  const [bio, setBio] = useState(draft.bio ?? "");
  const [website, setWebsite] = useState(draft.website ?? "");
  const [picture, setPicture] = useState<Img>(draft.picture);

  if (!ig) {
    return (
      <Empty>
        No Instagram account is connected. Link your Instagram professional account to your Facebook
        Page, then refresh accounts in Setup.
      </Empty>
    );
  }

  const saveDraft = () =>
    save.mutate(
      {
        facebook: {
          about: data.draft.facebook.about,
          description: data.draft.facebook.description,
          website: data.draft.facebook.website,
          phone: data.draft.facebook.phone,
          email: data.draft.facebook.email,
          pictureCreativeId: data.draft.facebook.picture?.id ?? null,
          coverCreativeId: data.draft.facebook.cover?.id ?? null,
        },
        instagram: {
          name: name.trim() || null,
          bio: bio.trim() || null,
          website: website.trim() || null,
          pictureCreativeId: picture?.id ?? null,
        },
      },
      {
        onSuccess: () => toast("Instagram draft saved"),
        onError: (err) => toast(errorMessage(err)),
      },
    );

  const pictureUrl = src(ig.profile.pictureUrl);

  return (
    <Panel>
      <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, minWidth: 0 }}>
          <div
            style={{
              width: 76,
              height: 76,
              borderRadius: 999,
              background: "#F7F6F3",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            {pictureUrl ? <Pic url={pictureUrl} alt="Instagram profile" /> : null}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 600 }}>
              <Camera size={15} aria-hidden /> @{ig.profile.username}
            </span>
            {ig.profile.name ? <span style={{ fontSize: 13 }}>{ig.profile.name}</span> : null}
            <span style={{ fontSize: 13, color: MUTED, whiteSpace: "pre-line" }}>
              {ig.profile.biography ?? "No bio yet"}
            </span>
            {ig.profile.website ? (
              <span
                style={{
                  fontSize: 13,
                  color: "#0F6B4A",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {ig.profile.website}
              </span>
            ) : null}
          </div>
        </div>

        <Checklist checks={ig.checks} score={ig.score} />

        <div
          style={{
            borderTop: LINE,
            paddingTop: 20,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <SubHead>Proposed changes</SubHead>
          <ImageChoice
            label="Profile picture"
            hint="Same square logo"
            image={picture}
            onChange={setPicture}
          />
          <Field label="Display name" hint={`${name.length}/30`}>
            <input
              className="rp-input"
              maxLength={30}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </Field>
          <Field label="Bio" hint={`${bio.length}/150`}>
            <textarea
              className="rp-input rp-textarea"
              rows={3}
              maxLength={150}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              style={TEXTAREA}
            />
          </Field>
          <Field label="Link in bio">
            <input
              className="rp-input"
              type="url"
              placeholder="https://"
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
            />
          </Field>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="button"
              className="rp-btn-light"
              disabled={save.isPending}
              onClick={saveDraft}
            >
              {save.isPending ? <Spinner /> : null}
              Save draft
            </button>
          </div>
        </div>

        <div
          style={{
            padding: 16,
            borderRadius: 12,
            background: "#F7F6F3",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <SubHead>Finish in the Instagram app</SubHead>
          <span style={{ fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
            Instagram doesn&apos;t let apps edit profiles, so this last step takes a minute on your
            phone.
          </span>
          <ol
            style={{
              listStyle: "none",
              margin: 0,
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 10,
              fontSize: 13,
              lineHeight: 1.5,
            }}
          >
            <li style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span className="rp-mono" style={{ color: MUTED }}>
                1.
              </span>{" "}
              Copy the bio
              {draft.bio ? (
                <CopyButton value={draft.bio} label="Copy bio" />
              ) : (
                <span style={{ color: MUTED }}>(save a bio first)</span>
              )}
            </li>
            <li style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span className="rp-mono" style={{ color: MUTED }}>
                2.
              </span>{" "}
              Save the logo to your phone
              {draft.picture ? (
                <a
                  href={src(draft.picture.url)!}
                  download={`${draft.picture.name}.png`}
                  className="rp-btn-light"
                  style={{ padding: "6px 11px", fontSize: 12.5 }}
                >
                  <Download size={14} /> Download logo
                </a>
              ) : (
                <span style={{ color: MUTED }}>(choose a logo first)</span>
              )}
            </li>
            <li>
              <span className="rp-mono" style={{ color: MUTED }}>
                3.
              </span>{" "}
              In Instagram open your profile → <strong>Edit profile</strong> → change picture, name,
              bio and links.
            </li>
            <li>
              <span className="rp-mono" style={{ color: MUTED }}>
                4.
              </span>{" "}
              Come back and press <strong>Recheck</strong>.
            </li>
          </ol>
        </div>
      </div>
    </Panel>
  );
}

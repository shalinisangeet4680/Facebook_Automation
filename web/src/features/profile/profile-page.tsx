"use client";

import {
  Camera,
  Check,
  CircleAlert,
  CircleDashed,
  Download,
  ExternalLink,
  ImagePlus,
  RefreshCw,
  Sparkles,
  Users,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CopyButton } from "@/components/ui/copy-button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/state";
import { errorMessage } from "@/lib/api/errors";
import {
  useApplyFacebookProfile,
  useCreatives,
  useProfile,
  useSaveProfileDraft,
} from "@/lib/api/queries";
import type { FacebookPart, ProfileCheckup } from "@/lib/api/types";
import { cn } from "@/lib/utils";

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

type Check = NonNullable<ProfileCheckup["facebook"]>["checks"][number];
type Image = { id: string; name: string; url: string } | null;

function src(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.pathname.startsWith("/media/") ? parsed.pathname : url;
  } catch {
    return url;
  }
}

export function ProfilePage() {
  const profile = useProfile();
  return (
    <>
      <PageHeader
        title="Page & Instagram"
        description="Complete your Facebook Page and Instagram profile so people trust your ads. Claude can write and design everything; you review and apply."
        actions={
          <Button
            variant="secondary"
            loading={profile.isFetching && !profile.isPending}
            onClick={() => void profile.refetch()}
          >
            <RefreshCw /> Recheck
          </Button>
        }
      />
      <Card className="mb-6">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <span className="bg-accent-soft text-accent grid size-11 shrink-0 place-items-center rounded-full">
            <Sparkles className="size-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">Let Claude prepare it</p>
            <p className="bg-surface-muted border-border mt-2 rounded-lg border px-3 py-2 text-[13px]">
              {PROMPT}
            </p>
          </div>
          <CopyButton value={PROMPT} label="Copy prompt" className="self-start sm:self-center" />
        </div>
      </Card>
      {profile.isPending ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <Skeleton className="h-96" />
          <Skeleton className="h-96" />
        </div>
      ) : profile.isError ? (
        <ErrorState message={errorMessage(profile.error)} onRetry={() => void profile.refetch()} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <FacebookCard key={JSON.stringify(profile.data.draft.facebook)} data={profile.data} />
          <InstagramCard key={JSON.stringify(profile.data.draft.instagram)} data={profile.data} />
        </div>
      )}
    </>
  );
}

function Checklist({ checks, score }: { checks: Check[]; score: number }) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[14px] font-medium">Checklist</p>
        <Badge tone={score === 100 ? "success" : score >= 50 ? "warning" : "danger"}>
          {score}% complete
        </Badge>
      </div>
      <ul className="grid gap-2">
        {checks.map((c) => (
          <li key={c.key} className="flex gap-2.5 text-[13px]">
            {c.status === "done" ? (
              <Check className="text-success mt-0.5 size-4 shrink-0" aria-label="Done" />
            ) : c.status === "weak" ? (
              <CircleAlert
                className="text-warning mt-0.5 size-4 shrink-0"
                aria-label="Could be better"
              />
            ) : (
              <CircleDashed className="text-subtle mt-0.5 size-4 shrink-0" aria-label="Missing" />
            )}
            <span>
              <span className="font-medium">{c.label}</span>
              {c.status !== "done" ? <span className="text-muted"> · {c.hint}</span> : null}
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
  image: Image;
  onChange: (image: Image) => void;
}) {
  const [open, setOpen] = useState(false);
  const creatives = useCreatives();
  return (
    <div role="group" aria-label={label} className="grid gap-1.5">
      <p className="text-[14px] font-medium">{label}</p>
      <div className="border-border flex items-center gap-3 rounded-lg border p-2.5">
        <div className="bg-surface-muted grid size-12 shrink-0 place-items-center overflow-hidden rounded-md">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={src(image.url)!} alt="" className="size-full object-cover" />
          ) : (
            <ImagePlus className="text-subtle size-5" aria-hidden />
          )}
        </div>
        <p className="text-small text-muted min-w-0 flex-1 truncate">{image ? image.name : hint}</p>
        {image ? (
          <Button type="button" size="sm" variant="ghost" onClick={() => onChange(null)}>
            Remove
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="secondary" onClick={() => setOpen(true)}>
          Choose
        </Button>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          title={`Choose ${label.toLowerCase()}`}
          description="From your Creatives library."
          className="max-h-[90dvh] max-w-2xl overflow-y-auto"
        >
          {!creatives.data?.data.length ? (
            <p className="text-small text-muted py-6 text-center">
              No images yet. Upload one in Creatives or ask Claude to design it.
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {creatives.data.data
                .filter((c) => c.kind !== "video")
                .map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange({ id: c.id, name: c.name, url: c.url });
                        setOpen(false);
                      }}
                      className={cn(
                        "border-border w-full overflow-hidden rounded-lg border text-left outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)]",
                        image?.id === c.id && "border-accent ring-accent ring-1",
                      )}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src(c.url)!}
                        alt=""
                        className="bg-surface-muted aspect-square w-full object-contain"
                      />
                      <p className="truncate p-2 text-[12px]">
                        {c.name} · {c.width}×{c.height}
                      </p>
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FacebookCard({ data }: { data: ProfileCheckup }) {
  const fb = data.facebook;
  const draft = data.draft.facebook;
  const save = useSaveProfileDraft();
  const apply = useApplyFacebookProfile();
  const [about, setAbout] = useState(draft.about ?? "");
  const [description, setDescription] = useState(draft.description ?? "");
  const [website, setWebsite] = useState(draft.website ?? "");
  const [phone, setPhone] = useState(draft.phone ?? "");
  const [email, setEmail] = useState(draft.email ?? "");
  const [picture, setPicture] = useState<Image>(draft.picture);
  const [cover, setCover] = useState<Image>(draft.cover);
  const [applyOpen, setApplyOpen] = useState(false);
  const [parts, setParts] = useState<FacebookPart[]>([]);

  if (!fb) {
    return (
      <Card className="text-small text-muted p-6">
        Select a Facebook Page in Setup to manage its profile.
      </Card>
    );
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
        onSuccess: () => toast.success("Facebook draft saved"),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );

  return (
    <Card className="min-w-0 overflow-hidden">
      <div className="bg-surface-muted relative aspect-[1640/624]">
        {src(cover?.url ?? fb.profile.coverUrl) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src(cover?.url ?? fb.profile.coverUrl)!}
            alt="Cover"
            className="size-full object-cover"
          />
        ) : (
          <p className="text-small text-muted grid size-full place-items-center">No cover photo</p>
        )}
        {cover && cover.url !== fb.profile.coverUrl ? (
          <Badge tone="accent" className="absolute top-2 right-2">
            Draft
          </Badge>
        ) : null}
      </div>
      <div className="grid gap-5 p-5">
        <div className="-mt-12 flex items-end gap-3">
          <div className="border-surface bg-surface-muted size-20 shrink-0 overflow-hidden rounded-full border-4">
            {src(picture?.url ?? (fb.profile.pictureIsDefault ? null : fb.profile.pictureUrl)) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src(picture?.url ?? fb.profile.pictureUrl)!}
                alt="Profile"
                className="size-full object-cover"
              />
            ) : null}
          </div>
          <div className="min-w-0 pb-1">
            <p className="flex items-center gap-1.5 truncate font-semibold">
              <Users className="size-4" aria-hidden /> {fb.profile.name}
            </p>
            {fb.profile.link ? (
              <a
                href={fb.profile.link}
                target="_blank"
                rel="noreferrer"
                className="text-caption text-accent inline-flex items-center gap-1 hover:underline"
              >
                Open Page <ExternalLink className="size-3" aria-hidden />
              </a>
            ) : null}
          </div>
        </div>

        <Checklist checks={fb.checks} score={fb.score} />

        <div className="border-border grid gap-4 border-t pt-5">
          <p className="text-[14px] font-semibold">Proposed changes</p>
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
            {(p) => (
              <Textarea
                {...p}
                rows={3}
                maxLength={255}
                value={about}
                onChange={(e) => setAbout(e.target.value)}
              />
            )}
          </Field>
          <Field label="Long description" hint="Optional, for the About section.">
            {(p) => (
              <Textarea
                {...p}
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Website">
              {(p) => (
                <Input
                  {...p}
                  type="url"
                  placeholder="https://"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              )}
            </Field>
            <Field label="Phone">
              {(p) => (
                <Input {...p} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              )}
            </Field>
          </div>
          <Field label="Email">
            {(p) => (
              <Input {...p} type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            )}
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="secondary" loading={save.isPending} onClick={saveDraft}>
              Save draft
            </Button>
            <Button
              disabled={!available.length}
              onClick={() => {
                setParts(available);
                setApplyOpen(true);
              }}
            >
              Apply to Page
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent
          title="Update your Facebook Page?"
          description="Visitors see these changes right away. Save the draft first if you edited anything."
        >
          <fieldset className="grid gap-2">
            <legend className="sr-only">What to update</legend>
            {available.map((part) => (
              <label key={part} className="flex items-center gap-2 text-[14px]">
                <input
                  type="checkbox"
                  className="size-4 accent-[var(--accent)]"
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
          <div className="mt-5 flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button
              disabled={!parts.length}
              loading={apply.isPending}
              onClick={() =>
                apply.mutate(parts, {
                  onSuccess: ({ results }) => {
                    setApplyOpen(false);
                    const failed = results.filter((r) => !r.ok);
                    if (!failed.length) toast.success("Page updated");
                    else
                      toast.warning(
                        `Updated ${results.length - failed.length} of ${results.length}. ${failed.map((f) => `${PART_LABELS[f.part]}: ${f.error}`).join(" ")}`,
                      );
                  },
                  onError: (err) => toast.error(errorMessage(err)),
                })
              }
            >
              Update Page
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function InstagramCard({ data }: { data: ProfileCheckup }) {
  const ig = data.instagram;
  const draft = data.draft.instagram;
  const save = useSaveProfileDraft();
  const [name, setName] = useState(draft.name ?? "");
  const [bio, setBio] = useState(draft.bio ?? "");
  const [website, setWebsite] = useState(draft.website ?? "");
  const [picture, setPicture] = useState<Image>(draft.picture);

  if (!ig) {
    return (
      <Card className="text-small text-muted p-6">
        No Instagram account is connected. Link your Instagram professional account to your Facebook
        Page, then refresh accounts in Setup.
      </Card>
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
        onSuccess: () => toast.success("Instagram draft saved"),
        onError: (err) => toast.error(errorMessage(err)),
      },
    );

  return (
    <Card className="min-w-0">
      <div className="grid gap-5 p-5">
        <div className="flex items-center gap-4">
          <div className="bg-surface-muted size-20 shrink-0 overflow-hidden rounded-full">
            {src(ig.profile.pictureUrl) ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={src(ig.profile.pictureUrl)!}
                alt="Instagram profile"
                className="size-full object-cover"
              />
            ) : null}
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 font-semibold">
              <Camera className="size-4" aria-hidden /> @{ig.profile.username}
            </p>
            {ig.profile.name ? <p className="text-small">{ig.profile.name}</p> : null}
            <p className="text-small text-muted whitespace-pre-line">
              {ig.profile.biography ?? "No bio yet"}
            </p>
            {ig.profile.website ? (
              <p className="text-small text-accent truncate">{ig.profile.website}</p>
            ) : null}
          </div>
        </div>

        <Checklist checks={ig.checks} score={ig.score} />

        <div className="border-border grid gap-4 border-t pt-5">
          <p className="text-[14px] font-semibold">Proposed changes</p>
          <ImageChoice
            label="Profile picture"
            hint="Same square logo"
            image={picture}
            onChange={setPicture}
          />
          <Field label="Display name" hint={`${name.length}/30`}>
            {(p) => (
              <Input {...p} maxLength={30} value={name} onChange={(e) => setName(e.target.value)} />
            )}
          </Field>
          <Field label="Bio" hint={`${bio.length}/150`}>
            {(p) => (
              <Textarea
                {...p}
                rows={3}
                maxLength={150}
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              />
            )}
          </Field>
          <Field label="Link in bio">
            {(p) => (
              <Input
                {...p}
                type="url"
                placeholder="https://"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />
            )}
          </Field>
          <div className="flex justify-end">
            <Button variant="secondary" loading={save.isPending} onClick={saveDraft}>
              Save draft
            </Button>
          </div>
        </div>

        <div className="bg-surface-muted grid gap-3 rounded-lg p-4">
          <p className="text-[14px] font-semibold">Finish in the Instagram app</p>
          <p className="text-small text-muted">
            Instagram doesn&apos;t let apps edit profiles, so this last step takes a minute on your
            phone.
          </p>
          <ol className="grid gap-2.5 text-[13px]">
            <li className="flex flex-wrap items-center gap-2">
              <span className="font-medium">1.</span> Copy the bio
              {draft.bio ? (
                <CopyButton value={draft.bio} label="Copy bio" />
              ) : (
                <span className="text-muted">(save a bio first)</span>
              )}
            </li>
            <li className="flex flex-wrap items-center gap-2">
              <span className="font-medium">2.</span> Save the logo to your phone
              {draft.picture ? (
                <Button asChild size="sm" variant="secondary">
                  <a href={src(draft.picture.url)!} download={`${draft.picture.name}.png`}>
                    <Download /> Download logo
                  </a>
                </Button>
              ) : (
                <span className="text-muted">(choose a logo first)</span>
              )}
            </li>
            <li>
              <span className="font-medium">3.</span> In Instagram open your profile →{" "}
              <strong>Edit profile</strong> → change picture, name, bio and links.
            </li>
            <li>
              <span className="font-medium">4.</span> Come back and press <strong>Recheck</strong>.
            </li>
          </ol>
        </div>
      </div>
    </Card>
  );
}

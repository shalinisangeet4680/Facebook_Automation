"use client";

import { AlertTriangle, MessageSquareReply, Plus, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Field, Input, inputClass } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/state";
import { errorMessage } from "@/lib/api/errors";
import {
  useAddPlayApp,
  useDiscoverApps,
  usePlayApps,
  usePlayConnections,
  useRemovePlayConnection,
} from "@/lib/api/queries";
import type { PlayApp, PlayConnection, PlayDiscovery } from "@/lib/api/types";

import { Sparkline, StatTile } from "./charts";
import { ConnectPlay } from "./connect-play";
import { DiscoveryPanel, Linkified } from "./discovery";
import { MODE, ago } from "./labels";
import { Rating } from "./stars";

export function AppIcon({
  app,
  size = 44,
}: {
  app: Pick<PlayApp, "title" | "iconUrl">;
  size?: number;
}) {
  return app.iconUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={app.iconUrl}
      alt=""
      width={size}
      height={size}
      className="border-border shrink-0 rounded-[22%] border"
    />
  ) : (
    <span
      style={{ width: size, height: size }}
      className="bg-accent-soft text-accent grid shrink-0 place-items-center rounded-[22%] text-[18px] font-semibold"
    >
      {app.title.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function ReviewApps() {
  const connections = usePlayConnections();
  const apps = usePlayApps();
  const [adding, setAdding] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [discovery, setDiscovery] = useState<PlayDiscovery | null>(null);
  const hasConnection = Boolean(connections.data?.data.length);

  return (
    <>
      <PageHeader
        title="Review replies"
        description="Reply to Google Play reviews with your own templates, rules that draft or send replies for you, or Claude. Nothing goes out without your approval unless you turn on auto-send for a rule."
        actions={
          hasConnection ? (
            <>
              <Button variant="secondary" onClick={() => setConnecting(true)}>
                Connect another account
              </Button>
              <Button onClick={() => setAdding(true)}>
                <Plus /> Add by package name
              </Button>
            </>
          ) : null
        }
      />
      {connections.isPending || apps.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-48" />
          ))}
        </div>
      ) : connections.isError || apps.isError ? (
        <ErrorState
          message={errorMessage(connections.error ?? apps.error)}
          onRetry={() => {
            void connections.refetch();
            void apps.refetch();
          }}
        />
      ) : !hasConnection ? (
        <ConnectPlay onDone={setDiscovery} />
      ) : (
        <div className="grid gap-8">
          {discovery ? (
            <DiscoveryPanel result={discovery} onClose={() => setDiscovery(null)} />
          ) : null}
          {apps.data.data.length ? <Summary apps={apps.data.data} /> : null}
          {apps.data.data.length ? (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {apps.data.data.map((app) => (
                <AppCard key={app.id} app={app} />
              ))}
            </ul>
          ) : (
            <Card>
              <EmptyState
                icon={<MessageSquareReply className="size-5" />}
                title="No apps yet"
                description="Use Find apps on your account below after giving it access in Play Console, or add an app by its package name."
                action={
                  <Button onClick={() => setAdding(true)}>
                    <Plus /> Add app
                  </Button>
                }
              />
            </Card>
          )}
          <Connections connections={connections.data.data} onDiscovered={setDiscovery} />
        </div>
      )}
      {hasConnection ? (
        <AddAppDialog
          open={adding}
          onOpenChange={setAdding}
          connections={connections.data?.data ?? []}
        />
      ) : null}
      <Dialog open={connecting} onOpenChange={setConnecting}>
        <DialogContent title="Connect another Google Play account" className="max-w-xl">
          <ConnectPlay
            compact
            onDone={(d) => {
              setConnecting(false);
              setDiscovery(d);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function Summary({ apps }: { apps: PlayApp[] }) {
  const rated = apps.filter((a) => a.rating !== null && a.reviews30d > 0);
  const weight = rated.reduce((n, a) => n + a.reviews30d, 0);
  const rating = weight ? rated.reduce((n, a) => n + a.rating! * a.reviews30d, 0) / weight : null;
  const sum = (k: "needsReply" | "waiting" | "needsClaude" | "reviews30d") =>
    apps.reduce((n, a) => n + a[k], 0);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        label="Average rating, 30 days"
        value={rating === null ? "–" : `${rating.toFixed(2)}★`}
        hint={`${sum("reviews30d")} reviews across ${apps.length} app${apps.length === 1 ? "" : "s"}`}
      />
      <StatTile
        label="Need a reply"
        value={String(sum("needsReply"))}
        hint="Reviews with text and no reply"
      />
      <StatTile
        label="Waiting for your approval"
        value={String(sum("waiting"))}
        hint="Drafted by rules or Claude"
      />
      <StatTile
        label="Waiting for Claude"
        value={String(sum("needsClaude"))}
        hint="Ask Claude to draft them"
      />
    </div>
  );
}

function AppCard({ app }: { app: PlayApp }) {
  const mode = MODE[app.mode];
  return (
    <li>
      <Link
        href={`/reviews/${app.id}`}
        className="group block h-full rounded-[var(--radius-card)] outline-none focus-visible:ring-4 focus-visible:ring-[var(--ring)]"
      >
        <Card className="group-hover:border-border-strong flex h-full flex-col gap-4 p-5 transition-colors">
          <div className="flex items-start gap-3">
            <AppIcon app={app} />
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-[15px] font-semibold">{app.title}</h2>
              <p className="text-small text-muted truncate">{app.packageName}</p>
            </div>
            <Badge tone={mode.tone}>{mode.label}</Badge>
          </div>
          <div className="flex items-end justify-between gap-3">
            <Rating value={app.rating} previous={app.previousRating} compact />
            <Sparkline
              values={app.trend}
              label={`Weekly average rating for ${app.title}, last 8 weeks`}
            />
          </div>
          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Need reply", value: app.needsReply, strong: app.needsReply > 0 },
              { label: "To approve", value: app.waiting, strong: app.waiting > 0 },
              { label: "30 days", value: app.reviews30d, strong: false },
            ].map((s) => (
              <div
                key={s.label}
                className="bg-surface-muted rounded-[var(--radius-control)] px-2 py-2"
              >
                <dt className="text-caption text-muted">{s.label}</dt>
                <dd
                  className={
                    s.strong ? "text-accent text-[17px] font-semibold" : "text-[17px] font-semibold"
                  }
                >
                  {s.value}
                </dd>
              </div>
            ))}
          </dl>
          <p className="text-caption text-muted mt-auto flex items-center gap-1.5">
            {app.syncError ? (
              <>
                <AlertTriangle className="text-danger size-3.5" />
                <span className="text-danger truncate">{app.syncError}</span>
              </>
            ) : (
              <>Checked {ago(app.lastSyncedAt)}</>
            )}
          </p>
        </Card>
      </Link>
    </li>
  );
}

function AddAppDialog({
  open,
  onOpenChange,
  connections,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  connections: PlayConnection[];
}) {
  const add = useAddPlayApp();
  const router = useRouter();
  const [connectionId, setConnectionId] = useState(connections[0]?.id ?? "");
  const [packageName, setPackageName] = useState("");
  const [title, setTitle] = useState("");
  const chosen = connectionId || connections[0]?.id || "";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        title="Add an app"
        description="Autopilot checks access, reads the app's name and icon from its store listing and fetches the last week of reviews."
      >
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate(
              {
                connectionId: chosen,
                packageName: packageName.trim(),
                title: title.trim() || undefined,
              },
              {
                onSuccess: (app) => {
                  toast.success(
                    `${app.title} added. ${app.firstSync?.fetched ?? 0} reviews fetched, ${app.firstSync?.drafts ?? 0} replies drafted for your approval.`,
                  );
                  onOpenChange(false);
                  router.push(`/reviews/${app.id}`);
                },
              },
            );
          }}
        >
          {connections.length > 1 ? (
            <Field label="Google Play account">
              {(props) => (
                <select
                  {...props}
                  className={inputClass}
                  value={chosen}
                  onChange={(e) => setConnectionId(e.target.value)}
                >
                  {connections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.clientEmail}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          ) : null}
          <Field
            label="Package name"
            hint="From the app's Play Store link: play.google.com/store/apps/details?id=com.acme.shop"
            error={add.isError ? errorMessage(add.error) : null}
          >
            {(props) => (
              <Input
                {...props}
                value={packageName}
                onChange={(e) => setPackageName(e.target.value)}
                placeholder="com.acme.shop"
                autoComplete="off"
                spellCheck={false}
                required
              />
            )}
          </Field>
          <Field label="Name (optional)" hint="Leave empty to use the name from the store listing.">
            {(props) => (
              <Input {...props} value={title} onChange={(e) => setTitle(e.target.value)} />
            )}
          </Field>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary" type="button">
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" loading={add.isPending} disabled={!packageName.trim()}>
              Add app
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Connections({
  connections,
  onDiscovered,
}: {
  connections: PlayConnection[];
  onDiscovered: (d: PlayDiscovery) => void;
}) {
  const remove = useRemovePlayConnection();
  const discover = useDiscoverApps();
  const [confirm, setConfirm] = useState<PlayConnection | null>(null);
  return (
    <section aria-label="Connected Google Play accounts">
      <h2 className="mb-3 text-[15px] font-semibold">Connected Google Play accounts</h2>
      <ul className="grid gap-2">
        {connections.map((c) => (
          <li key={c.id}>
            <Card className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-medium">{c.clientEmail}</p>
                <p className="text-caption text-muted">
                  Project {c.projectId} · {c.apps} {c.apps === 1 ? "app" : "apps"} · checked for new
                  apps {ago(c.discoveredAt)}
                </p>
                {c.discoveryError ? (
                  <p className="text-caption text-warning mt-1">
                    <Linkified text={c.discoveryError} />
                  </p>
                ) : null}
              </div>
              <Button
                variant="secondary"
                size="sm"
                loading={discover.isPending && discover.variables === c.id}
                onClick={() =>
                  discover.mutate(c.id, {
                    onSuccess: onDiscovered,
                    onError: (err) => toast.error(errorMessage(err)),
                  })
                }
              >
                <RefreshCw /> Find apps
              </Button>
              <Badge tone={c.status === "active" ? "success" : "danger"}>
                {c.status === "active" ? "Connected" : "Needs attention"}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="text-danger hover:bg-danger-soft hover:text-danger"
                aria-label={`Disconnect ${c.clientEmail}`}
                onClick={() => setConfirm(c)}
              >
                <Trash2 />
              </Button>
            </Card>
          </li>
        ))}
      </ul>
      <Dialog open={Boolean(confirm)} onOpenChange={(o) => !o && setConfirm(null)}>
        <DialogContent
          title="Disconnect this account?"
          description={`The key is deleted and ${confirm?.apps ?? 0} app(s) using it are removed from Autopilot with their review history. Replies already on Google Play stay.`}
        >
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button variant="secondary">Cancel</Button>
            </DialogClose>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() =>
                confirm &&
                remove.mutate(confirm.id, {
                  onSuccess: () => {
                    toast.success("Disconnected");
                    setConfirm(null);
                  },
                  onError: (err) => toast.error(errorMessage(err)),
                })
              }
            >
              Disconnect
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

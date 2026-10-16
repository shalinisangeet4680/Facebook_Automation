"use client";

import { ExternalLink, FileUp, KeyRound } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field, Textarea } from "@/components/ui/input";
import { errorMessage } from "@/lib/api/errors";
import { useConnectPlay } from "@/lib/api/queries";

const STEPS = [
  {
    title: "Turn on the Google Play Android Developer API",
    body: "In Google Cloud, pick or create a project and enable the API.",
    href: "https://console.cloud.google.com/apis/library/androidpublisher.googleapis.com",
    link: "Open the API page",
  },
  {
    title: "Create a service account and a JSON key",
    body: "Create a service account (no roles needed), open it, go to Keys, and add a JSON key. A .json file downloads.",
    href: "https://console.cloud.google.com/iam-admin/serviceaccounts",
    link: "Open service accounts",
  },
  {
    title: "Invite it in Play Console",
    body: 'In Users and permissions, invite the service account\'s email. Under App permissions add your apps and tick "Reply to reviews" and "View app information".',
    href: "https://play.google.com/console/users-and-permissions",
    link: "Open Play Console",
  },
  {
    title: "Paste the key here",
    body: "Upload the .json file or paste its contents. Autopilot stores it encrypted and only uses it to read and reply to reviews.",
  },
];

export function ConnectPlay({ onDone, compact }: { onDone?: () => void; compact?: boolean }) {
  const connect = useConnectPlay();
  const [key, setKey] = useState("");
  const file = useRef<HTMLInputElement>(null);

  const submit = () =>
    connect.mutate(key, {
      onSuccess: (c) => {
        toast.success(`Connected ${c.clientEmail}`);
        setKey("");
        onDone?.();
      },
    });

  return (
    <Card className={compact ? "p-0 shadow-none" : "p-6 sm:p-8"}>
      {!compact ? (
        <div className="mb-6 flex items-start gap-4">
          <span className="bg-accent-soft text-accent grid size-11 shrink-0 place-items-center rounded-full">
            <KeyRound className="size-5" />
          </span>
          <div>
            <h2 className="text-[17px] font-semibold">Connect your Google Play account</h2>
            <p className="text-muted mt-1">
              One connection covers every app in your Play Console. It takes about five minutes.
            </p>
          </div>
        </div>
      ) : null}
      <ol className="grid gap-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex gap-3">
            <span className="bg-surface-muted text-muted grid size-7 shrink-0 place-items-center rounded-full text-[13px] font-semibold">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-medium">{s.title}</p>
              <p className="text-small text-muted mt-0.5">{s.body}</p>
              {s.href ? (
                <a
                  href={s.href}
                  target="_blank"
                  rel="noreferrer"
                  className="text-small text-accent mt-1 inline-flex items-center gap-1 font-medium underline underline-offset-4"
                >
                  {s.link} <ExternalLink className="size-3" />
                </a>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-6 grid gap-3">
        <Field
          label="Service account key (JSON)"
          error={connect.isError ? errorMessage(connect.error) : null}
        >
          {(props) => (
            <Textarea
              {...props}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder='{ "type": "service_account", "project_id": "…", "client_email": "…" }'
              className="min-h-28 font-mono text-[13px]"
              spellCheck={false}
            />
          )}
        </Field>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={file}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="Upload the JSON key file"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = "";
              if (f) setKey(await f.text());
            }}
          />
          <Button variant="secondary" onClick={() => file.current?.click()}>
            <FileUp /> Upload .json file
          </Button>
          <Button onClick={submit} disabled={key.trim().length < 20} loading={connect.isPending}>
            Connect
          </Button>
        </div>
      </div>
    </Card>
  );
}

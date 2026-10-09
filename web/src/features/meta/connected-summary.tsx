"use client";

import { ArrowRight, CheckCircle2, RefreshCw, Unplug } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckRow } from "@/components/ui/check-row";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { errorMessage } from "@/lib/api/errors";
import { useDisconnectMeta } from "@/lib/api/queries";
import type { AssetKind, Connection } from "@/lib/api/types";

import { ASSET_LABELS } from "./asset-kinds";

const ORDER: AssetKind[] = ["ad_account", "page", "instagram", "dataset", "business"];

export function ConnectedSummary({
  connection,
  celebrate,
  onReplace,
}: {
  connection: Connection;
  celebrate: boolean;
  onReplace: () => void;
}) {
  const [open, setOpen] = useState(false);
  const disconnect = useDisconnectMeta();
  const counts = ORDER.map((kind) => ({
    kind,
    count: connection.assets.filter((a) => a.kind === kind).length,
  })).filter((c) => c.count > 0);
  const invalid = connection.status === "invalid";

  return (
    <div className="grid gap-6">
      <motion.div
        initial={celebrate ? { opacity: 0, y: 12, scale: 0.98 } : false}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
            <motion.span
              initial={celebrate ? { scale: 0, rotate: -30 } : false}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 18, delay: 0.1 }}
              className={`grid size-14 shrink-0 place-items-center rounded-full ${invalid ? "bg-danger-soft text-danger" : "bg-success-soft text-success"}`}
            >
              {invalid ? <Unplug className="size-7" /> : <CheckCircle2 className="size-7" />}
            </motion.span>
            <div className="min-w-0 flex-1">
              <h2 className="text-heading font-semibold">
                {invalid ? "Your Meta connection stopped working" : "Meta is connected"}
              </h2>
              <p className="text-muted mt-1">
                {invalid
                  ? "The token was revoked or expired. Generate a new one and replace it."
                  : `Connected as ${connection.systemUser?.name ?? "your system user"} · token ending ${connection.tokenLast4}`}
              </p>
              {counts.length ? (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {counts.map(({ kind, count }) => (
                    <Badge key={kind} tone="neutral">
                      {count} {count === 1 ? ASSET_LABELS[kind].one : ASSET_LABELS[kind].many}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
            {invalid ? (
              <Button size="lg" onClick={onReplace}>
                <RefreshCw /> Replace token
              </Button>
            ) : (
              <Button asChild size="lg">
                <Link href="/setup/accounts">
                  Choose accounts <ArrowRight />
                </Link>
              </Button>
            )}
          </div>
        </Card>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card>
          <div className="border-border border-b px-5 py-4">
            <h3 className="text-[15px] font-semibold">Connection checks</h3>
          </div>
          <div className="divide-border divide-y px-5 py-1.5">
            {connection.checks.map((c) => (
              <CheckRow key={c.key} state={c.status} label={c.label} message={c.message} />
            ))}
          </div>
        </Card>
        <Card className="h-fit">
          <div className="grid gap-4 p-5">
            <div>
              <h3 className="text-[15px] font-semibold">Manage connection</h3>
              <p className="text-small text-muted">
                Replace the token if you regenerate it in Meta, or disconnect to remove all access.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={onReplace}>
                <RefreshCw /> Replace token
              </Button>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="ghost"
                    className="text-danger hover:bg-danger-soft hover:text-danger"
                  >
                    <Unplug /> Disconnect
                  </Button>
                </DialogTrigger>
                <DialogContent
                  title="Disconnect Meta?"
                  description="We'll delete the stored token and your asset list. Automation stops until you connect again."
                >
                  <div className="flex justify-end gap-2">
                    <DialogClose asChild>
                      <Button variant="secondary">Cancel</Button>
                    </DialogClose>
                    <Button
                      variant="danger"
                      loading={disconnect.isPending}
                      onClick={() =>
                        disconnect.mutate(undefined, {
                          onSuccess: () => {
                            setOpen(false);
                            toast.success("Meta disconnected");
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
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

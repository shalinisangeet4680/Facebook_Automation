"use client";

import { ArrowLeft } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useCallback, useState } from "react";

import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/state";
import { errorMessage } from "@/lib/api/errors";
import { keys, useMetaConnection, useMetaRequirements } from "@/lib/api/queries";
import type { Connection, Requirements } from "@/lib/api/types";

import { ConnectedSummary } from "./connected-summary";
import { GuidePlayer } from "./guide/guide-player";
import { PermissionsCard } from "./permissions-card";
import { StepInstructions } from "./step-instructions";
import { TokenForm } from "./token-form";

function SetupView({
  requirements,
  onConnected,
}: {
  requirements: Requirements;
  onConnected: (connection: Connection) => void;
}) {
  const [index, setIndex] = useState(0);
  const onIndexChange = useCallback((i: number) => setIndex(i), []);
  const permissions = requirements.permissions
    .filter((p) => p.level !== "optional")
    .map((p) => p.name);
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="grid min-w-0 content-start gap-6">
        <GuidePlayer
          steps={requirements.steps}
          permissions={permissions}
          index={index}
          onIndexChange={onIndexChange}
        />
        <PermissionsCard permissions={requirements.permissions} />
      </div>
      <div className="grid min-w-0 content-start gap-6 xl:sticky xl:top-24 xl:self-start">
        <Card className="p-5">
          <StepInstructions
            step={requirements.steps[index]!}
            index={index}
            total={requirements.steps.length}
          />
        </Card>
        <TokenForm onConnected={onConnected} />
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <Skeleton className="aspect-[16/10] w-full rounded-[14px]" />
      <div className="grid content-start gap-6">
        <Skeleton className="h-40 w-full rounded-[12px]" />
        <Skeleton className="h-52 w-full rounded-[12px]" />
      </div>
    </div>
  );
}

export function ConnectMeta() {
  const client = useQueryClient();
  const connection = useMetaConnection();
  const requirements = useMetaRequirements();
  const [replacing, setReplacing] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const connected = connection.data && connection.data.status !== "not_connected";

  return (
    <>
      <Link
        href="/setup"
        className="text-small text-muted hover:text-foreground mb-6 inline-flex items-center gap-1.5 font-medium transition-colors"
      >
        <ArrowLeft className="size-4" /> Setup
      </Link>
      <PageHeader
        title={connected && !replacing ? "Meta connection" : "Connect your Meta business"}
        description={
          connected && !replacing
            ? "Your workspace can read and manage the assets you assigned to the system user."
            : "Follow the guide to create a system user token in Meta, then paste it here. It takes about five minutes."
        }
      />
      {connection.isPending || requirements.isPending ? (
        <Loading />
      ) : connection.isError || requirements.isError ? (
        <ErrorState
          message={errorMessage(connection.error ?? requirements.error)}
          onRetry={() => {
            void connection.refetch();
            void requirements.refetch();
          }}
        />
      ) : connected && !replacing ? (
        <ConnectedSummary
          connection={connection.data}
          celebrate={celebrate}
          onReplace={() => setReplacing(true)}
        />
      ) : (
        <SetupView
          requirements={requirements.data}
          onConnected={(next) => {
            client.setQueryData(keys.connection, next);
            setCelebrate(true);
            setReplacing(false);
          }}
        />
      )}
    </>
  );
}

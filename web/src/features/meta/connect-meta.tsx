"use client";

import { useQueryClient } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { errorMessage } from "@/lib/api/errors";
import { keys, useMetaConnection, useMetaRequirements } from "@/lib/api/queries";
import type { Connection, Requirements } from "@/lib/api/types";
import { Banner, PageHead, Skel, useToast } from "@/features/replyly/ui";

import { ConnectedSummary } from "./connected-summary";
import { MetaConnectOptions, useFacebookLogin } from "./facebook-connect";
import { GuidePlayer } from "./guide/guide-player";
import { PermissionsCard } from "./permissions-card";
import { StepInstructions } from "./step-instructions";
import { TokenForm } from "./token-form";

const columns = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 380px), 1fr))",
  gap: 20,
  alignItems: "start",
} as const;

const stack = { display: "flex", flexDirection: "column", gap: 20, minWidth: 0 } as const;

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
    <div style={columns}>
      <div style={stack}>
        <GuidePlayer
          steps={requirements.steps}
          permissions={permissions}
          index={index}
          onIndexChange={onIndexChange}
        />
        <PermissionsCard permissions={requirements.permissions} />
      </div>
      <div style={{ ...stack, position: "sticky", top: 24 }}>
        <div className="rp-card" style={{ padding: 20 }}>
          <StepInstructions
            step={requirements.steps[index]!}
            index={index}
            total={requirements.steps.length}
          />
        </div>
        <TokenForm onConnected={onConnected} />
      </div>
    </div>
  );
}

function Loading() {
  return (
    <div style={columns}>
      <Skel h={340} r={14} />
      <div style={stack}>
        <Skel h={160} r={14} />
        <Skel h={210} r={14} />
      </div>
    </div>
  );
}

export function ConnectMeta() {
  const client = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const toast = useToast();
  const connection = useMetaConnection();
  const requirements = useMetaRequirements();
  const facebook = useFacebookLogin();
  const [signInError, setSignInError] = useState(() => params.get("error"));
  const [replacing, setReplacing] = useState(false);
  const [celebrate, setCelebrate] = useState(() => params.get("connected") !== null);
  const connected = connection.data && connection.data.status !== "not_connected";
  const summary = connected && !replacing;
  const returned = params.get("error") !== null || params.get("connected") !== null;

  useEffect(() => {
    if (!returned) return;
    if (params.get("connected") !== null) toast("Meta is connected");
    router.replace(pathname, { scroll: false });
  }, [returned, params, pathname, router, toast]);

  return (
    <div className="rp-in" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <PageHead
        title={summary ? "Meta account" : "Connect your Meta business"}
        sub={
          summary
            ? connection.data?.method === "facebook_login"
              ? "Your workspace can read and manage the assets you chose when you signed in with Facebook."
              : "Your workspace can read and manage the assets you assigned to the system user."
            : facebook.available
              ? "Sign in with Facebook and choose what we can manage. It takes about a minute."
              : "Follow the guide to create a system user token in Meta, then paste it here. It takes about five minutes."
        }
        actions={
          connected && replacing ? (
            <button type="button" className="rp-btn-light" onClick={() => setReplacing(false)}>
              Cancel
            </button>
          ) : null
        }
      />
      {signInError ? (
        <Banner
          tone="error"
          title="Facebook sign-in didn’t finish"
          action={
            <button type="button" className="rp-btn-light" onClick={() => setSignInError(null)}>
              Dismiss
            </button>
          }
        >
          {signInError}
        </Banner>
      ) : null}
      {connection.isPending || requirements.isPending ? (
        <Loading />
      ) : connection.isError || requirements.isError ? (
        <Banner
          tone="error"
          title="Couldn’t load your Meta connection"
          action={
            <button
              type="button"
              className="rp-btn-light"
              onClick={() => {
                void connection.refetch();
                void requirements.refetch();
              }}
            >
              Try again
            </button>
          }
        >
          {errorMessage(connection.error ?? requirements.error)}
        </Banner>
      ) : summary ? (
        <ConnectedSummary
          connection={connection.data}
          celebrate={celebrate}
          onReplace={() => setReplacing(true)}
        />
      ) : (
        <MetaConnectOptions
          advancedOpen={replacing && connection.data?.method === "system_user_token"}
          advanced={
            <SetupView
              requirements={requirements.data}
              onConnected={(next) => {
                client.setQueryData(keys.connection, next);
                setSignInError(null);
                setCelebrate(true);
                setReplacing(false);
              }}
            />
          }
        />
      )}
    </div>
  );
}

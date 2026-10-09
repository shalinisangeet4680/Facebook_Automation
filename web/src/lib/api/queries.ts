"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { AssetSelection, Connection, Job } from "./types";

export const keys = {
  me: ["me"] as const,
  onboarding: ["onboarding"] as const,
  requirements: ["meta", "requirements"] as const,
  connection: ["meta", "connection"] as const,
  assets: ["meta", "assets"] as const,
  job: (id: string) => ["jobs", id] as const,
};

export function useMe() {
  return useQuery({ queryKey: keys.me, queryFn: () => unwrap(api.GET("/api/v1/me")) });
}

export function useOnboarding() {
  return useQuery({
    queryKey: keys.onboarding,
    queryFn: () => unwrap(api.GET("/api/v1/onboarding")),
  });
}

export function useMetaRequirements() {
  return useQuery({
    queryKey: keys.requirements,
    queryFn: () => unwrap(api.GET("/api/v1/meta/requirements")),
    staleTime: Infinity,
  });
}

export function useMetaConnection() {
  return useQuery({
    queryKey: keys.connection,
    queryFn: () => unwrap(api.GET("/api/v1/meta/connection")),
  });
}

export function useMetaAssets() {
  return useQuery({
    queryKey: keys.assets,
    queryFn: () => unwrap(api.GET("/api/v1/meta/assets")),
  });
}

export function useJob(jobId: string | null) {
  return useQuery({
    queryKey: keys.job(jobId ?? "none"),
    queryFn: () => unwrap(api.GET("/api/v1/jobs/{jobId}", { params: { path: { jobId: jobId! } } })),
    enabled: Boolean(jobId),
    refetchInterval: (query) => {
      const status = (query.state.data as Job | undefined)?.status;
      return status === "completed" || status === "failed" ? false : 800;
    },
  });
}

export function useRequestOtp() {
  return useMutation({
    mutationFn: (phone: string) =>
      unwrap(api.POST("/api/v1/auth/otp/request", { body: { phone } })),
  });
}

export function useVerifyOtp() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { phone: string; code: string }) =>
      unwrap(api.POST("/api/v1/auth/otp/verify", { body: input })),
    onSuccess: () => client.clear(),
  });
}

export function useSignOut() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/auth/logout")),
    onSettled: () => client.clear(),
  });
}

export function useConnectMeta() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => unwrap(api.POST("/api/v1/meta/connection", { body: { token } })),
    onSuccess: (connection: Connection) => {
      client.setQueryData(keys.connection, connection);
      void client.invalidateQueries({ queryKey: keys.onboarding });
      void client.invalidateQueries({ queryKey: keys.assets });
    },
  });
}

export function useSelectAssets() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (selection: AssetSelection) =>
      unwrap(api.PUT("/api/v1/meta/assets/selection", { body: selection })),
    onSuccess: (connection: Connection) => {
      client.setQueryData(keys.connection, connection);
      void client.invalidateQueries({ queryKey: keys.assets });
      void client.invalidateQueries({ queryKey: keys.onboarding });
    },
  });
}

export function useDisconnectMeta() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.DELETE("/api/v1/meta/connection")),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["meta"] });
      void client.invalidateQueries({ queryKey: keys.onboarding });
    },
  });
}

export function useRefreshAssets() {
  return useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/meta/assets/refresh")),
  });
}

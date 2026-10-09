"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, setSigningOut, unwrap } from "./client";
import type {
  AssetSelection,
  AuthorizationQuery,
  CampaignPlan,
  CreatePost,
  Connection,
  Job,
  PlanDetail,
  ProfileUpdate,
  ReportPreset,
  Settings,
  WorkspaceUpdate,
} from "./types";

export const keys = {
  me: ["me"] as const,
  onboarding: ["onboarding"] as const,
  requirements: ["meta", "requirements"] as const,
  connection: ["meta", "connection"] as const,
  assets: ["meta", "assets"] as const,
  job: (id: string) => ["jobs", id] as const,
  authorization: (query: AuthorizationQuery) => ["oauth", "authorization", query] as const,
  connector: ["connector"] as const,
  connectedApps: ["connected-apps"] as const,
  settings: ["settings"] as const,
  creatives: ["creatives"] as const,
  channels: ["social", "channels"] as const,
  posts: ["posts"] as const,
  library: (platform: string) => ["social", "library", platform] as const,
  report: (preset: string) => ["reports", preset] as const,
  plans: ["plans"] as const,
  plan: (id: string) => ["plans", id] as const,
  targeting: (type: string, q: string) => ["targeting", type, q] as const,
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
    onSuccess: () => {
      setSigningOut(false);
      client.clear();
    },
  });
}

export function useSignOut() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => {
      setSigningOut(true);
      return unwrap(api.POST("/api/v1/auth/logout"));
    },
    onSettled: () => client.clear(),
  });
}

export function useConnectMeta() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => unwrap(api.POST("/api/v1/meta/connection", { body: { token } })),
    onSuccess: () => {
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

export function useAuthorizationContext(query: AuthorizationQuery) {
  return useQuery({
    queryKey: keys.authorization(query),
    queryFn: () => unwrap(api.GET("/api/v1/oauth/authorization", { params: { query } })),
    retry: false,
    staleTime: Infinity,
  });
}

export function useAuthorizationDecision() {
  return useMutation({
    mutationFn: (body: AuthorizationQuery & { approve: boolean; allowWrite: boolean }) =>
      unwrap(api.POST("/api/v1/oauth/authorization", { body })),
  });
}

export function useConnector() {
  return useQuery({
    queryKey: keys.connector,
    queryFn: () => unwrap(api.GET("/api/v1/connector")),
    staleTime: Infinity,
  });
}

export function useConnectedApps() {
  return useQuery({
    queryKey: keys.connectedApps,
    queryFn: () => unwrap(api.GET("/api/v1/connected-apps")),
  });
}

export function useDisconnectApp() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE("/api/v1/connected-apps/{id}", { params: { path: { id } } })),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.connectedApps }),
  });
}

export function usePlans() {
  return useQuery({
    queryKey: keys.plans,
    queryFn: () => unwrap(api.GET("/api/v1/campaign-plans")),
  });
}

export function usePlan(id: string) {
  return useQuery({
    queryKey: keys.plan(id),
    queryFn: () => unwrap(api.GET("/api/v1/campaign-plans/{id}", { params: { path: { id } } })),
  });
}

function usePlanMutation<T>(id: string, run: (input: T) => Promise<Omit<PlanDetail, "options">>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: (plan) => {
      client.setQueryData<PlanDetail>(keys.plan(id), (old) => (old ? { ...old, ...plan } : old));
      void client.invalidateQueries({ queryKey: keys.plans, exact: true });
    },
  });
}

export function useSavePlan(id: string) {
  return usePlanMutation(id, (plan: CampaignPlan) =>
    unwrap(api.PUT("/api/v1/campaign-plans/{id}", { params: { path: { id } }, body: { plan } })),
  );
}

export function useCreatePlanInMeta(id: string) {
  return usePlanMutation(id, () =>
    unwrap(api.POST("/api/v1/campaign-plans/{id}/create", { params: { path: { id } } })),
  );
}

export function useLaunchPlan(id: string) {
  return usePlanMutation(id, () =>
    unwrap(
      api.POST("/api/v1/campaign-plans/{id}/launch", {
        params: { path: { id } },
        body: { confirm: true },
      }),
    ),
  );
}

export function useDiscardPlan(id: string) {
  return usePlanMutation(id, () =>
    unwrap(api.POST("/api/v1/campaign-plans/{id}/discard", { params: { path: { id } } })),
  );
}

export function useTargetingSearch(type: "city" | "region" | "interest", q: string) {
  return useQuery({
    queryKey: keys.targeting(type, q),
    queryFn: () => unwrap(api.GET("/api/v1/ads/targeting", { params: { query: { type, q } } })),
    enabled: q.trim().length >= 2,
    staleTime: 5 * 60_000,
  });
}

export function useSettings() {
  return useQuery({ queryKey: keys.settings, queryFn: () => unwrap(api.GET("/api/v1/settings")) });
}

export function useUpdateWorkspace() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: WorkspaceUpdate) => unwrap(api.PUT("/api/v1/settings/workspace", { body })),
    onSuccess: (settings: Settings) => {
      client.setQueryData(keys.settings, settings);
      void client.invalidateQueries({ queryKey: keys.me });
      void client.invalidateQueries({ queryKey: keys.connector });
    },
  });
}

export function useUpdateProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: ProfileUpdate) => unwrap(api.PUT("/api/v1/settings/profile", { body })),
    onSuccess: (settings: Settings) => {
      client.setQueryData(keys.settings, settings);
      void client.invalidateQueries({ queryKey: keys.me });
    },
  });
}

export function useSignOutEverywhere() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => {
      setSigningOut(true);
      return unwrap(api.POST("/api/v1/auth/logout-all"));
    },
    onSettled: () => client.clear(),
  });
}

export function useReport(preset: ReportPreset) {
  return useQuery({
    queryKey: keys.report(preset),
    queryFn: () => unwrap(api.GET("/api/v1/reports/overview", { params: { query: { preset } } })),
    placeholderData: (previous) => previous,
  });
}

export function useCreatives() {
  return useQuery({
    queryKey: keys.creatives,
    queryFn: () => unwrap(api.GET("/api/v1/creatives")),
  });
}

export function useUploadCreative() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ file, name }: { file: File; name?: string }) => {
      const form = new FormData();
      if (name) form.append("name", name);
      form.append("file", file);
      return unwrap(
        api.POST("/api/v1/creatives", {
          body: form as unknown as { file: string; name?: string },
          bodySerializer: (body) => body as unknown as FormData,
        }),
      );
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.creatives }),
  });
}

export function useDeleteCreative() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE("/api/v1/creatives/{id}", { params: { path: { id } } })),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.creatives }),
  });
}

export function useChannels() {
  return useQuery({
    queryKey: keys.channels,
    queryFn: () => unwrap(api.GET("/api/v1/social/channels")),
  });
}

export function usePosts() {
  return useQuery({
    queryKey: keys.posts,
    queryFn: () => unwrap(api.GET("/api/v1/posts")),
    refetchInterval: (query) =>
      query.state.data?.data.some(
        (p) =>
          p.status === "publishing" ||
          (p.status === "scheduled" && Date.parse(p.scheduledAt) < Date.now() + 60_000),
      )
        ? 2_000
        : false,
  });
}

export function useLibrary(platform: "facebook" | "instagram", enabled = true) {
  return useQuery({
    queryKey: keys.library(platform),
    queryFn: () => unwrap(api.GET("/api/v1/social/library", { params: { query: { platform } } })),
    enabled,
  });
}

export function useCreatePost() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePost) => unwrap(api.POST("/api/v1/posts", { body })),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.posts });
      void client.invalidateQueries({ queryKey: ["social", "library"] });
    },
  });
}

export function useCancelPost() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.POST("/api/v1/posts/{id}/cancel", { params: { path: { id } } })),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.posts }),
  });
}

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
  FacebookPart,
  ProfileDraftInput,
  ProfileUpdate,
  ReportPreset,
  Settings,
  StoreChoice,
  PlayAppUpdate,
  PlayRuleInput,
  PlayTemplateBody,
  PlayTemplateInput,
  PlayWorkspaceUpdate,
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
  inbox: ["inbox"] as const,
  profile: ["profile"] as const,
  channels: ["social", "channels"] as const,
  posts: ["posts"] as const,
  library: (platform: string) => ["social", "library", platform] as const,
  report: (preset: string) => ["reports", preset] as const,
  plans: ["plans"] as const,
  plan: (id: string) => ["plans", id] as const,
  targeting: (type: string, q: string) => ["targeting", type, q] as const,
  store: ["store"] as const,
  play: ["play"] as const,
  playConnections: ["play", "connections"] as const,
  playApps: ["play", "apps"] as const,
  playApp: (id: string) => ["play", "apps", id] as const,
  playReviews: (id: string, filters: PlayReviewFilters) =>
    ["play", "apps", id, "reviews", filters] as const,
  playTemplates: (appId?: string) => ["play", "templates", appId ?? "all"] as const,
  playRules: (id: string) => ["play", "apps", id, "rules"] as const,
  playInsights: (id: string, days: number) => ["play", "apps", id, "insights", days] as const,
  storeProject: (id: string) => ["store", id] as const,
  playWorkspace: ["play", "workspace"] as const,
  playClients: ["play", "workspace", "clients"] as const,
  playInbox: (filter: string, appId?: string, stars?: number) =>
    ["play", "inbox", filter, appId ?? "all", stars ?? "any"] as const,
  playAnalytics: (range: AnalyticsRange, appId?: string) =>
    ["play", "analytics", range, appId ?? "all"] as const,
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

export type TargetingType =
  "city" | "region" | "interest" | "work_position" | "industry" | "behavior";

export function useTargetingSearch(type: TargetingType, q: string) {
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

export function useInbox() {
  return useQuery({ queryKey: keys.inbox, queryFn: () => unwrap(api.GET("/api/v1/inbox")) });
}

export function useRefreshInbox() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/inbox/refresh")),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.inbox }),
  });
}

export function useSuggestionAction() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "apply" | "dismiss" | "snooze" }) =>
      unwrap(
        action === "apply"
          ? api.POST("/api/v1/inbox/suggestions/{id}/apply", { params: { path: { id } } })
          : action === "dismiss"
            ? api.POST("/api/v1/inbox/suggestions/{id}/dismiss", { params: { path: { id } } })
            : api.POST("/api/v1/inbox/suggestions/{id}/snooze", { params: { path: { id } } }),
      ),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.inbox });
      void client.invalidateQueries({ queryKey: ["reports"] });
    },
  });
}

export function useProfile() {
  return useQuery({ queryKey: keys.profile, queryFn: () => unwrap(api.GET("/api/v1/profile")) });
}

export function useSaveProfileDraft() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: ProfileDraftInput) => unwrap(api.PUT("/api/v1/profile/draft", { body })),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.profile }),
  });
}

export function useApplyFacebookProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (parts: FacebookPart[]) =>
      unwrap(api.POST("/api/v1/profile/facebook/apply", { body: { parts } })),
    onSuccess: (result) => client.setQueryData(keys.profile, result.checkup),
  });
}

export function useRetryPost() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.POST("/api/v1/posts/{id}/retry", { params: { path: { id } } })),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.posts });
      void client.invalidateQueries({ queryKey: keys.inbox });
    },
  });
}

const WAITING_FOR_PLUGIN = new Set(["draft", "choosing", "style_chosen"]);

export function useStoreProjects() {
  return useQuery({
    queryKey: keys.store,
    queryFn: () => unwrap(api.GET("/api/v1/store-projects")),
  });
}

export function useStoreProject(id: string) {
  return useQuery({
    queryKey: keys.storeProject(id),
    queryFn: () => unwrap(api.GET("/api/v1/store-projects/{id}", { params: { path: { id } } })),
    refetchInterval: (query) =>
      query.state.data && WAITING_FOR_PLUGIN.has(query.state.data.status) ? 4_000 : false,
  });
}

export function useChooseStoreStyle(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (choice: StoreChoice) =>
      unwrap(
        api.PUT("/api/v1/store-projects/{id}/choice", {
          params: { path: { id } },
          body: choice,
        }),
      ),
    onSuccess: (project) => {
      client.setQueryData(keys.storeProject(id), project);
      void client.invalidateQueries({ queryKey: keys.store, exact: true });
    },
  });
}

export function useAddStoreToCreatives(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (assetIds: string[]) =>
      unwrap(
        api.POST("/api/v1/store-projects/{id}/creatives", {
          params: { path: { id } },
          body: { assetIds },
        }),
      ),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.creatives }),
  });
}

export function useDeleteStoreProject() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE("/api/v1/store-projects/{id}", { params: { path: { id } } })),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.store }),
  });
}

export interface PlayReviewFilters {
  state?: "unreplied" | "waiting" | "claude" | "scheduled" | "failed" | "replied" | "skipped";
  stars?: number[];
  language?: string;
  version?: string;
  q?: string;
  page?: number;
}

function usePlayInvalidate() {
  const client = useQueryClient();
  return (appId?: string) => {
    void client.invalidateQueries({ queryKey: keys.playApps, exact: true });
    if (appId) void client.invalidateQueries({ queryKey: keys.playApp(appId) });
  };
}

export function usePlayConnections() {
  return useQuery({
    queryKey: keys.playConnections,
    queryFn: () => unwrap(api.GET("/api/v1/play/connections")),
  });
}

export function useConnectPlay() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => unwrap(api.POST("/api/v1/play/connections", { body: { key } })),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.play }),
  });
}

export function useDiscoverApps() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.POST("/api/v1/play/connections/{id}/discover", { params: { path: { id } } })),
    onSettled: () => void client.invalidateQueries({ queryKey: keys.play }),
  });
}

export function useRemovePlayConnection() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE("/api/v1/play/connections/{id}", { params: { path: { id } } })),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.play }),
  });
}

export function usePlayApps() {
  return useQuery({
    queryKey: keys.playApps,
    queryFn: () => unwrap(api.GET("/api/v1/play/apps")),
  });
}

export function useAddPlayApp() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: { connectionId: string; packageName: string; title?: string }) =>
      unwrap(api.POST("/api/v1/play/apps", { body })),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.play }),
  });
}

export function usePlayApp(id: string) {
  return useQuery({
    queryKey: keys.playApp(id),
    queryFn: () => unwrap(api.GET("/api/v1/play/apps/{id}", { params: { path: { id } } })),
  });
}

export function useUpdatePlayApp(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: PlayAppUpdate) =>
      unwrap(api.PUT("/api/v1/play/apps/{id}", { params: { path: { id } }, body })),
    onSuccess: (app) => {
      client.setQueryData(keys.playApp(id), app);
      void client.invalidateQueries({ queryKey: keys.playApps, exact: true });
      void client.invalidateQueries({ queryKey: keys.playTemplates(id) });
    },
  });
}

export function useRemovePlayApp() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE("/api/v1/play/apps/{id}", { params: { path: { id } } })),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.play }),
  });
}

export function useSyncPlayApp(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/play/apps/{id}/sync", { params: { path: { id } } })),
    onSettled: () => void client.invalidateQueries({ queryKey: keys.playApp(id) }),
  });
}

export function usePlayReviews(id: string, filters: PlayReviewFilters) {
  return useQuery({
    queryKey: keys.playReviews(id, filters),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/play/apps/{id}/reviews", {
          params: {
            path: { id },
            query: {
              state: filters.state,
              stars: filters.stars?.length ? filters.stars.join(",") : undefined,
              language: filters.language || undefined,
              version: filters.version || undefined,
              q: filters.q?.trim() || undefined,
              page: filters.page,
              pageSize: 20,
            },
          },
        }),
      ),
    placeholderData: (previous) => previous,
  });
}

export function usePreviewReply(appId: string) {
  return useMutation({
    mutationFn: (body: { reviewId: string; templateId: string }) =>
      unwrap(api.POST("/api/v1/play/apps/{id}/preview", { params: { path: { id: appId } }, body })),
  });
}

function useReviewMutation<T, R>(appId: string, run: (input: T) => Promise<R>) {
  const invalidate = usePlayInvalidate();
  return useMutation({ mutationFn: run, onSettled: () => invalidate(appId) });
}

export function useReplyNow(appId: string) {
  return useReviewMutation(
    appId,
    (input: { reviewId: string; text: string; templateId?: string }) =>
      unwrap(
        api.POST("/api/v1/play/apps/{id}/reviews/{reviewId}/reply", {
          params: { path: { id: appId, reviewId: input.reviewId } },
          body: { text: input.text, templateId: input.templateId },
        }),
      ),
  );
}

export function useSaveReplyDraft(appId: string) {
  return useReviewMutation(
    appId,
    (input: { reviewId: string; text: string; templateId?: string }) =>
      unwrap(
        api.PUT("/api/v1/play/apps/{id}/reviews/{reviewId}/draft", {
          params: { path: { id: appId, reviewId: input.reviewId } },
          body: { text: input.text, templateId: input.templateId },
        }),
      ),
  );
}

export function useApproveReply(appId: string) {
  return useReviewMutation(appId, (input: { replyId: string; text?: string }) =>
    unwrap(
      api.POST("/api/v1/play/replies/{id}/approve", {
        params: { path: { id: input.replyId } },
        body: { text: input.text },
      }),
    ),
  );
}

export function useDiscardReply(appId: string) {
  return useReviewMutation(appId, (replyId: string) =>
    unwrap(api.POST("/api/v1/play/replies/{id}/discard", { params: { path: { id: replyId } } })),
  );
}

export function useBulkReply(appId: string) {
  return useReviewMutation(appId, (body: { reviewIds: string[]; templateId: string }) =>
    unwrap(
      api.POST("/api/v1/play/apps/{id}/bulk-reply", { params: { path: { id: appId } }, body }),
    ),
  );
}

export function usePlayTemplates(appId?: string) {
  return useQuery({
    queryKey: keys.playTemplates(appId),
    queryFn: () => unwrap(api.GET("/api/v1/play/templates", { params: { query: { appId } } })),
  });
}

export function useCheckTemplate() {
  return useMutation({
    mutationFn: (body: { bodies: PlayTemplateBody[]; appId?: string | null }) =>
      unwrap(api.POST("/api/v1/play/templates/check", { body })),
  });
}

function useTemplateMutation<T, R>(run: (input: T) => Promise<R>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSuccess: () => void client.invalidateQueries({ queryKey: ["play", "templates"] }),
  });
}

export function useSaveTemplate() {
  return useTemplateMutation((input: { id?: string; body: PlayTemplateInput }) =>
    unwrap(
      input.id
        ? api.PUT("/api/v1/play/templates/{id}", {
            params: { path: { id: input.id } },
            body: input.body,
          })
        : api.POST("/api/v1/play/templates", { body: input.body }),
    ),
  );
}

export function useDeleteTemplate() {
  return useTemplateMutation((id: string) =>
    unwrap(api.DELETE("/api/v1/play/templates/{id}", { params: { path: { id } } })),
  );
}

export function useRestorePresets() {
  return useTemplateMutation(() => unwrap(api.POST("/api/v1/play/templates/presets")));
}

export function usePlayRules(appId: string) {
  return useQuery({
    queryKey: keys.playRules(appId),
    queryFn: () =>
      unwrap(api.GET("/api/v1/play/apps/{id}/rules", { params: { path: { id: appId } } })),
  });
}

export function useSaveRules(appId: string) {
  const client = useQueryClient();
  const invalidate = usePlayInvalidate();
  return useMutation({
    mutationFn: (rules: PlayRuleInput[]) =>
      unwrap(
        api.PUT("/api/v1/play/apps/{id}/rules", {
          params: { path: { id: appId } },
          body: { rules },
        }),
      ),
    onSuccess: (saved) => {
      client.setQueryData(keys.playRules(appId), saved);
      void client.invalidateQueries({ queryKey: ["play", "templates"] });
      invalidate(appId);
    },
  });
}

export function usePlayInsights(id: string, days: number) {
  return useQuery({
    queryKey: keys.playInsights(id, days),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/play/apps/{id}/insights", {
          params: { path: { id }, query: { days: String(days) } },
        }),
      ),
    placeholderData: (previous) => previous,
  });
}

export function useImportReport(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return unwrap(
        api.POST("/api/v1/play/apps/{id}/import", {
          params: { path: { id } },
          body: form as unknown as { file: string },
          bodySerializer: (body) => body as unknown as FormData,
        }),
      );
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.playApp(id) }),
  });
}

export function usePlayWorkspace() {
  return useQuery({
    queryKey: keys.playWorkspace,
    queryFn: () => unwrap(api.GET("/api/v1/play/workspace")),
  });
}

export function useUpdatePlayWorkspace() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: PlayWorkspaceUpdate) => unwrap(api.PUT("/api/v1/play/workspace", { body })),
    onSuccess: (data) => client.setQueryData(keys.playWorkspace, data),
  });
}

export function useRevealPlayToken() {
  return useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/play/workspace/token/reveal")),
  });
}

export function useRotatePlayToken() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/play/workspace/token/rotate")),
    onSettled: () => void client.invalidateQueries({ queryKey: keys.playWorkspace }),
  });
}

export function usePlayClients() {
  return useQuery({
    queryKey: keys.playClients,
    queryFn: () => unwrap(api.GET("/api/v1/play/workspace/clients")),
  });
}

export function useRevokePlayClient() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE("/api/v1/play/workspace/clients/{id}", { params: { path: { id } } })),
    onSettled: () => void client.invalidateQueries({ queryKey: keys.playWorkspace }),
  });
}

export function usePlayInbox(
  filter: "pending" | "replied" | "all",
  appId?: string,
  stars?: number,
) {
  return useQuery({
    queryKey: keys.playInbox(filter, appId, stars),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/play/inbox", {
          params: { query: { filter, appId, stars: stars ? String(stars) : undefined } },
        }),
      ),
    placeholderData: (previous) => previous,
  });
}

function useInboxMutation<T, R>(run: (input: T) => Promise<R>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: run,
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ["play", "inbox"] });
      void client.invalidateQueries({ queryKey: keys.playApps });
    },
  });
}

export function useSkipReview() {
  return useInboxMutation((id: string) =>
    unwrap(api.POST("/api/v1/play/reviews/{id}/skip", { params: { path: { id } } })),
  );
}

export function useDraftReview() {
  return useInboxMutation((input: { id: string; rewrite: boolean }) =>
    unwrap(
      input.rewrite
        ? api.POST("/api/v1/play/reviews/{id}/rewrite", { params: { path: { id: input.id } } })
        : api.POST("/api/v1/play/reviews/{id}/draft", { params: { path: { id: input.id } } }),
    ),
  );
}

export function useApproveInboxReply() {
  return useInboxMutation((input: { replyId: string; text?: string }) =>
    unwrap(
      api.POST("/api/v1/play/replies/{id}/approve", {
        params: { path: { id: input.replyId } },
        body: { text: input.text },
      }),
    ),
  );
}

export function useSaveInboxDraft() {
  return useInboxMutation((input: { appId: string; reviewId: string; text: string }) =>
    unwrap(
      api.PUT("/api/v1/play/apps/{id}/reviews/{reviewId}/draft", {
        params: { path: { id: input.appId, reviewId: input.reviewId } },
        body: { text: input.text },
      }),
    ),
  );
}

export function useReplyFromInbox() {
  return useInboxMutation((input: { appId: string; reviewId: string; text: string }) =>
    unwrap(
      api.POST("/api/v1/play/apps/{id}/reviews/{reviewId}/reply", {
        params: { path: { id: input.appId, reviewId: input.reviewId } },
        body: { text: input.text },
      }),
    ),
  );
}

export function useApproveAll() {
  return useInboxMutation((replyIds: string[]) =>
    unwrap(api.POST("/api/v1/play/inbox/approve-all", { body: { replyIds } })),
  );
}

export type AnalyticsRange =
  | { kind: "today" }
  | { kind: "days"; days: 7 | 30 | 90 }
  | { kind: "all" }
  | { kind: "custom"; from: string; to: string };

function localDay() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function usePlayAnalytics(range: AnalyticsRange, appId?: string) {
  return useQuery({
    queryKey: keys.playAnalytics(range, appId),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/play/analytics", {
          params: {
            query: {
              appId,
              ...(range.kind === "days"
                ? { days: range.days }
                : range.kind === "all"
                  ? { all: "true" as const }
                  : range.kind === "today"
                    ? { from: localDay(), to: localDay() }
                    : { from: range.from, to: range.to }),
            },
          },
        }),
      ),
    placeholderData: (previous) => previous,
  });
}

export function useRecheckPlayApp(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () =>
      unwrap(api.POST("/api/v1/play/apps/{id}/recheck", { params: { path: { id } } })),
    onSuccess: (app) => {
      client.setQueryData(keys.playApp(id), app);
      void client.invalidateQueries({ queryKey: keys.playApps, exact: true });
    },
  });
}

export function useResumePlayApp(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () =>
      unwrap(api.POST("/api/v1/play/apps/{id}/resume", { params: { path: { id } } })),
    onSuccess: (app) => {
      client.setQueryData(keys.playApp(id), app);
      void client.invalidateQueries({ queryKey: keys.playApps, exact: true });
    },
  });
}

export function useDuplicateTemplate() {
  return useTemplateMutation((id: string) =>
    unwrap(api.POST("/api/v1/play/templates/{id}/duplicate", { params: { path: { id } } })),
  );
}

export function syncPlayApp(id: string) {
  return unwrap(api.POST("/api/v1/play/apps/{id}/sync", { params: { path: { id } } }));
}

export function useSetReportsBucket() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { connectionId: string; uri: string | null }) =>
      unwrap(
        api.PUT("/api/v1/play/connections/{id}/reports", {
          params: { path: { id: input.connectionId } },
          body: { uri: input.uri },
        }),
      ),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.play }),
  });
}

export function useImportHistory(appId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (all: boolean) =>
      unwrap(
        api.POST("/api/v1/play/apps/{id}/history", {
          params: { path: { id: appId }, query: { all: all ? "true" : undefined } },
        }),
      ),
    onSettled: () => void client.invalidateQueries({ queryKey: keys.play }),
  });
}

export function discoverPlayApps(connectionId: string) {
  return unwrap(
    api.POST("/api/v1/play/connections/{id}/discover", { params: { path: { id: connectionId } } }),
  );
}

export function fetchPlayApps() {
  return unwrap(api.GET("/api/v1/play/apps"));
}

export function useVariableSuggestions(appId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["play", "apps", appId, "variable-suggestions"],
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/play/apps/{id}/variable-suggestions", { params: { path: { id: appId } } }),
      ),
    enabled,
    staleTime: 60_000,
  });
}

export function useSetTemplateHidden() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; hidden: boolean }) =>
      unwrap(
        api.PUT("/api/v1/play/templates/{id}/visibility", {
          params: { path: { id: input.id } },
          body: { hidden: input.hidden },
        }),
      ),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["play", "templates"] }),
  });
}

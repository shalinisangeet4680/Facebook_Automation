"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components } from "./schema";

type Schemas = components["schemas"];

export type SocialPlatform = "instagram" | "facebook";
export type AutopostAccount = Schemas["AutopostAccountDto"];
export type AutopostAccountDetail = Schemas["AutopostAccountDetailDto"];
export type AutopostSettings = Schemas["AutopostSettingsViewDto"];
export type AutopostSettingsInput = Schemas["UpdateAutopostAccountDto"];
export type AutopostPost = Schemas["AutopostPostDto"];
export type AutopostPostInput = Schemas["CreateAutopostDto"];
export type AutopostPostPatch = Schemas["UpdateAutopostDto"];
export type AutopostMedia = Schemas["AutopostMediaDto"];
export type AutopostFormat = AutopostPost["format"];
export type AutopostContentType = AutopostPost["contentType"];
export type AutopostStatus = AutopostPost["status"];
export type AutopostPlan = Schemas["AutopostPlanDto"];
export type AutopostInsights = Schemas["AutopostInsightsDto"];
export type AutopostComment = Schemas["AutopostCommentDto"];
export type AutopostCommentClass = AutopostComment["class"];
export type BrandKitResponse = Schemas["BrandKitResponseDto"];
export type BrandKit = Schemas["BrandKitViewDto"];
export type BrandKitPatch = Schemas["BrandKitPatchDto"];
export type BestTimes = Schemas["BestTimesDto"];
export type PostMode = AutopostPost["mode"];

const root = ["autopost"] as const;

export const autopostKeys = {
  root,
  status: [...root, "status"] as const,
  accounts: (platform?: SocialPlatform) => [...root, "accounts", platform ?? "all"] as const,
  account: (id: string) => [...root, "account", id] as const,
  brandKit: (accountId?: string) => [...root, "brand-kit", accountId ?? "workspace"] as const,
  calendar: (platform: SocialPlatform, from: string, to: string, accountId?: string) =>
    [...root, "calendar", platform, from, to, accountId ?? "all"] as const,
  posts: (platform: SocialPlatform, status?: string, accountId?: string) =>
    [...root, "posts", platform, status ?? "all", accountId ?? "all"] as const,
  insights: (platform: SocialPlatform, days: number, accountId?: string) =>
    [...root, "insights", platform, days, accountId ?? "all"] as const,
  comments: (platform: SocialPlatform, filter: string, classes?: string, accountId?: string) =>
    [...root, "comments", platform, filter, classes ?? "all", accountId ?? "all"] as const,
};

function useInvalidate() {
  const client = useQueryClient();
  return () => void client.invalidateQueries({ queryKey: root });
}

export function useAutopostStatus() {
  return useQuery({
    queryKey: autopostKeys.status,
    queryFn: () => unwrap(api.GET("/api/v1/autopost/status")),
    staleTime: Infinity,
  });
}

export function useAutopostAccounts(platform?: SocialPlatform) {
  return useQuery({
    queryKey: autopostKeys.accounts(platform),
    queryFn: () =>
      unwrap(api.GET("/api/v1/autopost/accounts", { params: { query: { platform } } })),
  });
}

export function useAutopostAccount(id: string | undefined) {
  return useQuery({
    queryKey: autopostKeys.account(id ?? ""),
    enabled: Boolean(id),
    queryFn: () =>
      unwrap(api.GET("/api/v1/autopost/accounts/{id}", { params: { path: { id: id! } } })),
  });
}

export function useStartAutopostSignIn() {
  return useMutation({
    mutationFn: (body: { login: "facebook" | "instagram"; product: SocialPlatform }) =>
      unwrap(
        api.POST("/api/v1/autopost/oauth/start", {
          body: { ...body, origin: window.location.origin },
        }),
      ),
  });
}

export function useUpdateAutopostAccount(id: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: AutopostSettingsInput) =>
      unwrap(api.PUT("/api/v1/autopost/accounts/{id}", { params: { path: { id } }, body })),
    onSettled: invalidate,
  });
}

export function useResumeAutopostAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.POST("/api/v1/autopost/accounts/{id}/resume", { params: { path: { id } } })),
    onSettled: invalidate,
  });
}

export function useRemoveAutopostAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE("/api/v1/autopost/accounts/{id}", { params: { path: { id } } })),
    onSettled: invalidate,
  });
}

export function useSyncAutopostAccount() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.POST("/api/v1/autopost/accounts/{id}/sync", { params: { path: { id } } })),
    onSettled: invalidate,
  });
}

export function useBrandKit(accountId?: string) {
  return useQuery({
    queryKey: autopostKeys.brandKit(accountId),
    queryFn: () =>
      unwrap(api.GET("/api/v1/autopost/brand-kit", { params: { query: { accountId } } })),
  });
}

export function useSaveBrandKit(accountId?: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: BrandKitPatch) =>
      unwrap(api.PUT("/api/v1/autopost/brand-kit", { params: { query: { accountId } }, body })),
    onSettled: invalidate,
  });
}

export function useResetBrandKit(accountId: string) {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: () =>
      unwrap(api.DELETE("/api/v1/autopost/brand-kit", { params: { query: { accountId } } })),
    onSettled: invalidate,
  });
}

export function usePrefillBrandKit() {
  return useMutation({
    mutationFn: (body: { accountId?: string; websiteUrl?: string }) =>
      unwrap(api.POST("/api/v1/autopost/brand-kit/prefill", { body })),
  });
}

export function useGeneratePlan() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: { accountId: string; weekStart?: string }) =>
      unwrap(api.POST("/api/v1/autopost/plans", { body })),
    onSettled: invalidate,
  });
}

export function useCalendar(
  platform: SocialPlatform,
  from: string,
  to: string,
  accountId?: string,
) {
  return useQuery({
    queryKey: autopostKeys.calendar(platform, from, to, accountId),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/autopost/calendar", {
          params: { query: { platform, from, to, accountId } },
        }),
      ),
    placeholderData: (previous) => previous,
  });
}

export function useAutopostPosts(platform: SocialPlatform, status?: string, accountId?: string) {
  return useQuery({
    queryKey: autopostKeys.posts(platform, status, accountId),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/autopost/posts", {
          params: { query: { platform, status, accountId } },
        }),
      ),
    placeholderData: (previous) => previous,
  });
}

export function useCreateAutopost() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: AutopostPostInput) => unwrap(api.POST("/api/v1/autopost/posts", { body })),
    onSettled: invalidate,
  });
}

export function useUpdateAutopost() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: AutopostPostPatch & { id: string }) =>
      unwrap(api.PUT("/api/v1/autopost/posts/{id}", { params: { path: { id } }, body })),
    onSettled: invalidate,
  });
}

export function useWriteAutopost() {
  return useMutation({
    mutationFn: (body: Schemas["WriteAutopostDto"]) =>
      unwrap(api.POST("/api/v1/autopost/posts/write", { body })),
  });
}

type PostAction = "approve" | "cancel" | "retry" | "publish";

export function useAutopostAction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: PostAction }) => {
      const opts = { params: { path: { id } } };
      if (action === "approve")
        return unwrap(api.POST("/api/v1/autopost/posts/{id}/approve", opts));
      if (action === "cancel") return unwrap(api.POST("/api/v1/autopost/posts/{id}/cancel", opts));
      if (action === "retry") return unwrap(api.POST("/api/v1/autopost/posts/{id}/retry", opts));
      return unwrap(api.POST("/api/v1/autopost/posts/{id}/publish", opts));
    },
    onSettled: invalidate,
  });
}

export function useRegenerateAutopost() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: ({ id, part }: { id: string; part: "caption" | "image" }) =>
      unwrap(
        api.POST("/api/v1/autopost/posts/{id}/regenerate", {
          params: { path: { id } },
          body: { part },
        }),
      ),
    onSettled: invalidate,
  });
}

export function useDeleteAutopost() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE("/api/v1/autopost/posts/{id}", { params: { path: { id } } })),
    onSettled: invalidate,
  });
}

export function useApproveAllAutoposts() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (body: { platform: SocialPlatform; accountId?: string }) =>
      unwrap(api.POST("/api/v1/autopost/posts/approve-all", { body })),
    onSettled: invalidate,
  });
}

export function useAutopostInsights(
  platform: SocialPlatform,
  days: 7 | 30 | 90,
  accountId?: string,
) {
  return useQuery({
    queryKey: autopostKeys.insights(platform, days, accountId),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/autopost/insights", {
          params: { query: { platform, days, accountId } },
        }),
      ),
    placeholderData: (previous) => previous,
  });
}

export function useAutopostComments(
  platform: SocialPlatform,
  filter: "open" | "replied" | "all",
  classes?: string,
  accountId?: string,
) {
  return useQuery({
    queryKey: autopostKeys.comments(platform, filter, classes, accountId),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/autopost/comments", {
          params: { query: { platform, filter, classes, accountId } },
        }),
      ),
    placeholderData: (previous) => previous,
  });
}

type CommentAction =
  | { kind: "reply"; id: string; text: string }
  | { kind: "draft"; id: string; text: string }
  | { kind: "ai"; id: string; rewrite?: boolean }
  | { kind: "hide"; id: string; hidden: boolean }
  | { kind: "skip"; id: string; undo?: boolean }
  | { kind: "approve"; replyId: string; text?: string }
  | { kind: "discard"; replyId: string };

export function useCommentAction() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (a: CommentAction) => {
      if (a.kind === "approve")
        return unwrap(
          api.POST("/api/v1/autopost/comment-replies/{id}/approve", {
            params: { path: { id: a.replyId } },
            body: { text: a.text },
          }),
        );
      if (a.kind === "discard")
        return unwrap(
          api.POST("/api/v1/autopost/comment-replies/{id}/discard", {
            params: { path: { id: a.replyId } },
          }),
        );
      const path = { params: { path: { id: a.id } } };
      if (a.kind === "reply")
        return unwrap(
          api.POST("/api/v1/autopost/comments/{id}/reply", { ...path, body: { text: a.text } }),
        );
      if (a.kind === "draft")
        return unwrap(
          api.PUT("/api/v1/autopost/comments/{id}/draft", { ...path, body: { text: a.text } }),
        );
      if (a.kind === "ai")
        return unwrap(
          api.POST("/api/v1/autopost/comments/{id}/ai-draft", {
            ...path,
            body: { rewrite: a.rewrite },
          }),
        );
      if (a.kind === "hide")
        return unwrap(
          api.POST("/api/v1/autopost/comments/{id}/hide", {
            ...path,
            body: { hidden: a.hidden },
          }),
        );
      return a.undo
        ? unwrap(api.DELETE("/api/v1/autopost/comments/{id}/skip", path))
        : unwrap(api.POST("/api/v1/autopost/comments/{id}/skip", path));
    },
    onSettled: invalidate,
  });
}

export function useApproveAllReplies() {
  const invalidate = useInvalidate();
  return useMutation({
    mutationFn: (replyIds: string[]) =>
      unwrap(api.POST("/api/v1/autopost/comment-replies/approve-all", { body: { replyIds } })),
    onSettled: invalidate,
  });
}

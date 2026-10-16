"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { AnalyticsRange } from "./queries";
import type { components } from "./schema";

type Schemas = components["schemas"];

export type GbpLocation = Schemas["GbpLocationDto"];
export type GbpLocationDetail = Schemas["GbpLocationDetailDto"];
export type GbpReview = Schemas["GbpReviewDto"];
export type GbpReviewState = GbpReview["state"];
export type GbpTemplate = Schemas["GbpTemplateDto"];
export type GbpTemplateInput = Schemas["BusinessTemplateDto"];
export type GbpPost = Schemas["GbpPostDto"];
export type GbpPostContent = Schemas["PostContentDto"];
export type GbpPostInput = Schemas["CreateGbpPostDto"];
export type GbpInfo = Schemas["BusinessInfoDto"];
export type GbpInfoPatch = Schemas["InfoPatchDto"];
export type GbpOpeningPeriod = Schemas["OpeningPeriodDto"];
export type GbpInsights = Schemas["BusinessInsightsDto"];
export type GbpMetrics = Schemas["MetricsDto"];
export type GbpAnalytics = Schemas["BusinessAnalyticsDto"];
export type GbpLocationUpdate = Schemas["UpdateLocationDto"];
export type GbpSettings = Schemas["BusinessSettingsViewDto"];
export type GbpRatingRule = Schemas["BusinessRatingRuleViewDto"];

const root = ["business"] as const;

export const businessKeys = {
  root,
  status: [...root, "status"] as const,
  dashboard: [...root, "dashboard"] as const,
  connections: [...root, "connections"] as const,
  locations: [...root, "locations"] as const,
  location: (id: string) => [...root, "locations", id] as const,
  reviews: (id: string, stars?: number) =>
    [...root, "locations", id, "reviews", stars ?? "any"] as const,
  info: (id: string) => [...root, "locations", id, "info"] as const,
  suggestions: (id: string) => [...root, "locations", id, "suggestions"] as const,
  inbox: (filter: string, locationId?: string, stars?: number) =>
    [...root, "inbox", filter, locationId ?? "all", stars ?? "any"] as const,
  analytics: (range: AnalyticsRange, locationId?: string) =>
    [...root, "analytics", range, locationId ?? "all"] as const,
  insights: (range: AnalyticsRange, locationId?: string) =>
    [...root, "insights", range, locationId ?? "all"] as const,
  templates: (locationId?: string) => [...root, "templates", locationId ?? "all"] as const,
  posts: (locationId?: string) => [...root, "posts", locationId ?? "all"] as const,
};

function localDay() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function rangeQuery(range: AnalyticsRange) {
  return range.kind === "days"
    ? { days: range.days }
    : range.kind === "all"
      ? { all: "true" as const }
      : range.kind === "today"
        ? { from: localDay(), to: localDay() }
        : { from: range.from, to: range.to };
}

function useBusinessInvalidate() {
  const client = useQueryClient();
  return () => void client.invalidateQueries({ queryKey: root });
}

export function useBusinessStatus() {
  return useQuery({
    queryKey: businessKeys.status,
    queryFn: () => unwrap(api.GET("/api/v1/business/status")),
    staleTime: Infinity,
  });
}

export function useBusinessDashboard() {
  return useQuery({
    queryKey: businessKeys.dashboard,
    queryFn: () => unwrap(api.GET("/api/v1/business/dashboard")),
  });
}

export function useBusinessConnections() {
  return useQuery({
    queryKey: businessKeys.connections,
    queryFn: () => unwrap(api.GET("/api/v1/business/connections")),
  });
}

export function useStartGoogleSignIn() {
  return useMutation({
    mutationFn: () =>
      unwrap(
        api.POST("/api/v1/business/oauth/start", {
          body: { origin: window.location.origin },
        }),
      ),
  });
}

export function useDisconnectGoogle() {
  const invalidate = useBusinessInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE("/api/v1/business/connections/{id}", { params: { path: { id } } })),
    onSettled: invalidate,
  });
}

export function useDiscoverLocations() {
  const invalidate = useBusinessInvalidate();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/business/discover")),
    onSettled: invalidate,
  });
}

export function useSyncAllLocations() {
  const invalidate = useBusinessInvalidate();
  return useMutation({
    mutationFn: () => unwrap(api.POST("/api/v1/business/locations/sync")),
    onSettled: invalidate,
  });
}

export function useLocations() {
  return useQuery({
    queryKey: businessKeys.locations,
    queryFn: () => unwrap(api.GET("/api/v1/business/locations")),
  });
}

export function useLocation(id: string) {
  return useQuery({
    queryKey: businessKeys.location(id),
    queryFn: () => unwrap(api.GET("/api/v1/business/locations/{id}", { params: { path: { id } } })),
  });
}

export function useUpdateLocation(id: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: GbpLocationUpdate) =>
      unwrap(api.PUT("/api/v1/business/locations/{id}", { params: { path: { id } }, body })),
    onSuccess: (location) => {
      client.setQueryData(businessKeys.location(id), location);
      void client.invalidateQueries({ queryKey: businessKeys.locations, exact: true });
    },
  });
}

export function useRemoveLocation() {
  const invalidate = useBusinessInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE("/api/v1/business/locations/{id}", { params: { path: { id } } })),
    onSettled: invalidate,
  });
}

export function useSyncLocation(id: string) {
  const invalidate = useBusinessInvalidate();
  return useMutation({
    mutationFn: () =>
      unwrap(api.POST("/api/v1/business/locations/{id}/sync", { params: { path: { id } } })),
    onSettled: invalidate,
  });
}

export function useLocationReviews(id: string, stars?: number) {
  return useQuery({
    queryKey: businessKeys.reviews(id, stars),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/business/locations/{id}/reviews", {
          params: { path: { id }, query: { stars: stars ? String(stars) : undefined } },
        }),
      ),
    placeholderData: (previous) => previous,
  });
}

export function useBusinessInbox(
  filter: "pending" | "replied" | "all",
  locationId?: string,
  stars?: number,
) {
  return useQuery({
    queryKey: businessKeys.inbox(filter, locationId, stars),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/business/inbox", {
          params: { query: { filter, locationId, stars: stars ? String(stars) : undefined } },
        }),
      ),
    placeholderData: (previous) => previous,
  });
}

export function useBusinessAnalytics(range: AnalyticsRange, locationId?: string) {
  return useQuery({
    queryKey: businessKeys.analytics(range, locationId),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/business/analytics", {
          params: { query: { locationId, ...rangeQuery(range) } },
        }),
      ),
    placeholderData: (previous) => previous,
  });
}

export function useBusinessInsights(range: AnalyticsRange, locationId?: string) {
  return useQuery({
    queryKey: businessKeys.insights(range, locationId),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/business/insights", {
          params: { query: { locationId, ...rangeQuery(range) } },
        }),
      ),
    placeholderData: (previous) => previous,
  });
}

function useReviewMutation<T, R>(run: (input: T) => Promise<R>) {
  const invalidate = useBusinessInvalidate();
  return useMutation({ mutationFn: run, onSettled: invalidate });
}

export function useBusinessReply() {
  return useReviewMutation((input: { reviewId: string; text: string; templateId?: string }) =>
    unwrap(
      api.POST("/api/v1/business/reviews/{id}/reply", {
        params: { path: { id: input.reviewId } },
        body: { text: input.text, templateId: input.templateId },
      }),
    ),
  );
}

export function useBusinessSaveDraft() {
  return useReviewMutation((input: { reviewId: string; text: string }) =>
    unwrap(
      api.PUT("/api/v1/business/reviews/{id}/draft", {
        params: { path: { id: input.reviewId } },
        body: { text: input.text },
      }),
    ),
  );
}

export function useBusinessAiDraft() {
  return useReviewMutation((input: { reviewId: string; rewrite?: boolean }) =>
    unwrap(
      api.POST("/api/v1/business/reviews/{id}/ai-draft", {
        params: { path: { id: input.reviewId } },
        body: { rewrite: input.rewrite },
      }),
    ),
  );
}

export function useBusinessSkip() {
  return useReviewMutation((input: { reviewId: string; undo?: boolean }) =>
    input.undo
      ? unwrap(
          api.DELETE("/api/v1/business/reviews/{id}/skip", {
            params: { path: { id: input.reviewId } },
          }),
        )
      : unwrap(
          api.POST("/api/v1/business/reviews/{id}/skip", {
            params: { path: { id: input.reviewId } },
          }),
        ),
  );
}

export function useBusinessDeleteReply() {
  return useReviewMutation((reviewId: string) =>
    unwrap(
      api.DELETE("/api/v1/business/reviews/{id}/reply", { params: { path: { id: reviewId } } }),
    ),
  );
}

export function useBusinessApprove() {
  return useReviewMutation((input: { replyId: string; text?: string }) =>
    unwrap(
      api.POST("/api/v1/business/replies/{id}/approve", {
        params: { path: { id: input.replyId } },
        body: { text: input.text },
      }),
    ),
  );
}

export function useBusinessDiscard() {
  return useReviewMutation((replyId: string) =>
    unwrap(
      api.POST("/api/v1/business/replies/{id}/discard", { params: { path: { id: replyId } } }),
    ),
  );
}

export function useBusinessApproveAll() {
  return useReviewMutation((replyIds: string[]) =>
    unwrap(api.POST("/api/v1/business/replies/approve-all", { body: { replyIds } })),
  );
}

export function useBusinessTemplates(locationId?: string) {
  return useQuery({
    queryKey: businessKeys.templates(locationId),
    queryFn: () =>
      unwrap(api.GET("/api/v1/business/templates", { params: { query: { locationId } } })),
  });
}

export function useSaveBusinessTemplate() {
  const invalidate = useBusinessInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: GbpTemplateInput & { id?: string }) =>
      id
        ? unwrap(api.PUT("/api/v1/business/templates/{id}", { params: { path: { id } }, body }))
        : unwrap(api.POST("/api/v1/business/templates", { body })),
    onSettled: invalidate,
  });
}

export function useBusinessTemplateHidden() {
  const invalidate = useBusinessInvalidate();
  return useMutation({
    mutationFn: ({ id, hidden }: { id: string; hidden: boolean }) =>
      unwrap(
        api.PUT("/api/v1/business/templates/{id}/visibility", {
          params: { path: { id } },
          body: { hidden },
        }),
      ),
    onSettled: invalidate,
  });
}

export function useDeleteBusinessTemplate() {
  const invalidate = useBusinessInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE("/api/v1/business/templates/{id}", { params: { path: { id } } })),
    onSettled: invalidate,
  });
}

export function useBusinessPosts(locationId?: string) {
  return useQuery({
    queryKey: businessKeys.posts(locationId),
    queryFn: () => unwrap(api.GET("/api/v1/business/posts", { params: { query: { locationId } } })),
  });
}

export function useSaveBusinessPost() {
  const invalidate = useBusinessInvalidate();
  return useMutation({
    mutationFn: ({ id, ...body }: GbpPostInput & { id?: string }) =>
      id
        ? unwrap(
            api.PUT("/api/v1/business/posts/{id}", {
              params: { path: { id } },
              body: { content: body.content, when: body.when, scheduledAt: body.scheduledAt },
            }),
          )
        : unwrap(api.POST("/api/v1/business/posts", { body })),
    onSettled: invalidate,
  });
}

export function useDeleteBusinessPost() {
  const invalidate = useBusinessInvalidate();
  return useMutation({
    mutationFn: (id: string) =>
      unwrap(api.DELETE("/api/v1/business/posts/{id}", { params: { path: { id } } })),
    onSettled: invalidate,
  });
}

export function useLocationInfo(id: string) {
  return useQuery({
    queryKey: businessKeys.info(id),
    queryFn: () =>
      unwrap(api.GET("/api/v1/business/locations/{id}/info", { params: { path: { id } } })),
  });
}

export function usePreviewInfo(id: string) {
  return useMutation({
    mutationFn: (body: GbpInfoPatch) =>
      unwrap(
        api.POST("/api/v1/business/locations/{id}/info/preview", {
          params: { path: { id } },
          body,
        }),
      ),
  });
}

export function useUpdateInfo(id: string) {
  const invalidate = useBusinessInvalidate();
  return useMutation({
    mutationFn: (body: GbpInfoPatch) =>
      unwrap(api.PUT("/api/v1/business/locations/{id}/info", { params: { path: { id } }, body })),
    onSettled: invalidate,
  });
}

export function useBusinessSuggestions(id: string) {
  return useQuery({
    queryKey: businessKeys.suggestions(id),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/business/locations/{id}/variable-suggestions", {
          params: { path: { id } },
        }),
      ),
  });
}

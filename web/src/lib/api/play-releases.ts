"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { api, unwrap } from "./client";
import type { components } from "./schema";

type Schemas = components["schemas"];

export type ReleasesOverview = Schemas["ReleasesOverviewDto"];
export type ReleaseTrack = Schemas["TrackViewDto"];
export type Release = Schemas["ReleaseViewDto"];
export type ReleaseNote = Schemas["ReleaseNoteViewDto"];
export type ReleaseEvent = Schemas["ReleaseEventDto"];
export type Guardian = Schemas["GuardianViewDto"];
export type GuardianInput = Schemas["GuardianDto"];
export type RolloutInput = Schemas["RolloutDto"];
export type PromoteInput = Schemas["PromoteDto"];
export type SaveNotesInput = Schemas["SaveNotesDto"];
export type DraftNotesInput = Schemas["DraftNotesDto"];
export type AppHealth = Schemas["AppHealthDto"];
export type RatePoint = Schemas["RatePointDto"];
export type VersionHealth = Schemas["VersionHealthDto"];
export type ErrorIssue = Schemas["ErrorIssueDto"];
export type ErrorIssueDetail = Schemas["ErrorIssueDetailDto"];
export type CrashExplanation = Schemas["CrashExplanationDto"];
export type HealthDays = 7 | 14 | 28;

const root = ["play-releases"] as const;

export const releaseKeys = {
  root,
  overview: (id: string) => [...root, id, "overview"] as const,
  health: (id: string, days: number) => [...root, id, "health", days] as const,
  issues: (id: string, type: string) => [...root, id, "issues", type] as const,
  issue: (id: string, issueId: string) => [...root, id, "issue", issueId] as const,
};

const path = (id: string) => ({ params: { path: { id } } });

export function useReleases(id: string | null) {
  return useQuery({
    queryKey: releaseKeys.overview(id ?? ""),
    queryFn: () => unwrap(api.GET("/api/v1/play-releases/apps/{id}", path(id!))),
    enabled: Boolean(id),
    retry: false,
  });
}

function useTrackMutation<T, R>(id: string, fn: (body: T) => Promise<R>) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => void client.invalidateQueries({ queryKey: [...root, id] }),
  });
}

export function useRollout(id: string) {
  return useTrackMutation(id, (body: RolloutInput) =>
    unwrap(api.POST("/api/v1/play-releases/apps/{id}/rollout", { ...path(id), body })),
  );
}

export function usePromote(id: string) {
  return useTrackMutation(id, (body: PromoteInput) =>
    unwrap(api.POST("/api/v1/play-releases/apps/{id}/promote", { ...path(id), body })),
  );
}

export function useSaveNotes(id: string) {
  return useTrackMutation(id, (body: SaveNotesInput) =>
    unwrap(api.PUT("/api/v1/play-releases/apps/{id}/notes", { ...path(id), body })),
  );
}

export function useDraftNotes(id: string) {
  return useMutation({
    mutationFn: (body: DraftNotesInput) =>
      unwrap(api.POST("/api/v1/play-releases/apps/{id}/notes/draft", { ...path(id), body })),
  });
}

export function useUpdateGuardian(id: string) {
  return useTrackMutation(id, (body: GuardianInput) =>
    unwrap(api.PUT("/api/v1/play-releases/apps/{id}/guardian", { ...path(id), body })),
  );
}

export function useCheckGuardian(id: string) {
  return useTrackMutation(id, () =>
    unwrap(api.POST("/api/v1/play-releases/apps/{id}/guardian/check", path(id))),
  );
}

export function useAppHealth(id: string | null, days: HealthDays) {
  return useQuery({
    queryKey: releaseKeys.health(id ?? "", days),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/play-releases/apps/{id}/health", {
          params: { path: { id: id! }, query: { days } },
        }),
      ),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useErrorIssues(id: string | null, type: "CRASH" | "ANR" | null) {
  return useQuery({
    queryKey: releaseKeys.issues(id ?? "", type ?? "all"),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/play-releases/apps/{id}/issues", {
          params: { path: { id: id! }, query: type ? { type } : {} },
        }),
      ),
    enabled: Boolean(id),
    retry: false,
  });
}

export function useErrorIssue(id: string, issueId: string | null) {
  return useQuery({
    queryKey: releaseKeys.issue(id, issueId ?? ""),
    queryFn: () =>
      unwrap(
        api.GET("/api/v1/play-releases/apps/{id}/issues/{issueId}", {
          params: { path: { id, issueId: issueId! } },
        }),
      ),
    enabled: Boolean(issueId),
  });
}

export function useExplainCrash(id: string) {
  return useMutation({
    mutationFn: (issueId: string) =>
      unwrap(
        api.POST("/api/v1/play-releases/apps/{id}/issues/{issueId}/explain", {
          params: { path: { id, issueId } },
        }),
      ),
  });
}

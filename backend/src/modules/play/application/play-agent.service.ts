import { Injectable } from "@nestjs/common";

import { ValidationError } from "@shared/errors/domain-error";

import { AiMode, AppSettings, RatingRule } from "../domain/play.types";
import { PlayActor, PlayEngine } from "./play-engine.service";
import { AppUpdate, PlayService, RuleInput } from "./play.service";
import { PlayWorkspaceService } from "./play-workspace.service";

const DELAY_LABEL: Record<string, string> = {
  instant: "Instantly",
  "15m": "15 min",
  "1h": "1 hour",
  "6h": "6 hours",
};

const BEHAVIOR_LABEL: Record<string, string> = {
  translate: "Reply in the reviewer’s language",
  personalize: "Let AI personalize templates",
  skipEmpty: "Skip star-only reviews",
  escalate: "Escalate 1★ reviews",
  autoPause: "Safety pause",
  replyToEdited: "Reply again when a review is edited",
};

const show = (v: unknown) =>
  v === null || v === undefined || v === ""
    ? "(none)"
    : typeof v === "boolean"
      ? v
        ? "on"
        : "off"
      : Array.isArray(v)
        ? v.join(", ") || "(none)"
        : typeof v === "object"
          ? JSON.stringify(v)
          : String(v);

export interface SettingsPreview {
  changes: string[];
  enablesAuto: boolean;
}

@Injectable()
export class PlayAgentService {
  constructor(
    private readonly engine: PlayEngine,
    private readonly play: PlayService,
    private readonly workspace: PlayWorkspaceService,
  ) {}

  async settingsForClaude(workspaceId: string, appId: string) {
    const app = await this.play.appRow(workspaceId, appId);
    const settings = this.engine.settingsOf(app);
    const ratingRules = await this.engine.ratingRules(app);
    const templates = (await this.play.templates(workspaceId, app.id)).data;
    const name = (id: string | null) =>
      id
        ? (templates.find((t) => t.id === id)?.name ?? "missing template")
        : "AI-written, no template";
    const rules = (await this.play.rules(workspaceId, app.id)).data;
    const ws = await this.workspace.get(workspaceId);
    return {
      app: {
        id: app.id,
        title: app.title,
        package_name: app.packageName,
        auto_reply_enabled: app.automation,
        paused_until: app.pausedUntil?.toISOString() ?? null,
      },
      rating_rules: ratingRules.map((r) => ({
        rating: r.rating,
        mode: r.mode,
        template_id: r.templateId,
        template: name(r.templateId),
      })),
      behavior: {
        delay: settings.delay,
        tone: settings.tone,
        translate: settings.translate,
        personalize: settings.personalize,
        skip_empty: settings.skipEmpty,
        escalate: settings.escalate,
        auto_pause: settings.autoPause,
        reply_to_edited: settings.replyToEdited,
      },
      safeguards: {
        timezone: settings.timezone,
        quiet_hours: settings.quietHours,
        daily_auto_limit: settings.dailyAutoLimit,
        never_auto_words: settings.neverAutoWords,
      },
      placeholders: app.variables,
      advanced_rules: rules.map((r) => ({
        id: r.id,
        name: r.name,
        enabled: r.enabled,
        conditions: r.conditions,
        action:
          r.action.type === "template"
            ? {
                type: "template",
                template_id: r.action.templateId,
                template: name(r.action.templateId ?? null),
              }
            : { type: r.action.type },
        mode: r.mode,
        delay_minutes: r.delayMinutes,
      })),
      templates: templates.map((t) => ({
        id: t.id,
        name: t.name,
        ratings: t.ratings,
        built_in: t.builtIn,
        hidden: t.hidden,
      })),
      workspace: {
        ai_mode: ws.aiMode,
        ai_ready: ws.aiReady,
        slack_connected: ws.slackConnected,
        slack_channel: ws.slackChannel,
        agents_can_post: ws.agentsCanPost,
      },
      options: {
        modes: ["auto", "approval", "manual"],
        delays: Object.keys(DELAY_LABEL),
        tones: ["friendly", "professional", "concise"],
        ai_modes: ["platform", "own", "off"],
      },
      url: this.play.reviewsUrl(app.id),
    };
  }

  async previewApp(
    workspaceId: string,
    appId: string,
    input: AppUpdate,
  ): Promise<SettingsPreview> {
    const app = await this.play.appRow(workspaceId, appId);
    const settings = this.engine.settingsOf(app);
    const current = await this.engine.ratingRules(app);
    const templates = (await this.play.templates(workspaceId, app.id)).data;
    const name = (id: string | null) =>
      id ? (templates.find((t) => t.id === id)?.name ?? id) : "AI-written";
    const changes: string[] = [];
    let enablesAuto = false;
    if (input.title !== undefined && input.title !== app.title)
      changes.push(`Name: ${app.title} → ${input.title}`);
    if (input.automation !== undefined && input.automation !== app.automation)
      changes.push(
        `Auto-reply: ${show(app.automation)} → ${show(input.automation)}`,
      );
    const s = input.settings ?? {};
    for (const next of s.ratingRules ?? []) {
      const before = current.find((r) => r.rating === next.rating);
      if (!before) continue;
      if (
        next.templateId !== undefined &&
        !templates.some((t) => t.id === next.templateId) &&
        next.templateId !== null
      )
        throw new ValidationError(
          `Template ${next.templateId} doesn't exist for this app.`,
        );
      if (next.mode && next.mode !== before.mode) {
        changes.push(`${next.rating}★ mode: ${before.mode} → ${next.mode}`);
        if (next.mode === "auto") enablesAuto = true;
      }
      if (
        next.templateId !== undefined &&
        next.templateId !== before.templateId
      )
        changes.push(
          `${next.rating}★ template: ${name(before.templateId)} → ${name(next.templateId)}`,
        );
    }
    const plain: [keyof AppSettings, string][] = [
      ["delay", "Posting delay"],
      ["tone", "Voice"],
      ["timezone", "Time zone"],
      ["quietHours", "Quiet hours"],
      ["dailyAutoLimit", "Daily automatic replies"],
      ["neverAutoWords", "Never auto-reply words"],
      ["translate", BEHAVIOR_LABEL.translate!],
      ["personalize", BEHAVIOR_LABEL.personalize!],
      ["skipEmpty", BEHAVIOR_LABEL.skipEmpty!],
      ["escalate", BEHAVIOR_LABEL.escalate!],
      ["autoPause", BEHAVIOR_LABEL.autoPause!],
      ["replyToEdited", BEHAVIOR_LABEL.replyToEdited!],
    ];
    for (const [key, label] of plain) {
      if (s[key] === undefined) continue;
      if (JSON.stringify(s[key]) === JSON.stringify(settings[key])) continue;
      const fmt = (v: unknown) =>
        key === "delay" ? (DELAY_LABEL[String(v)] ?? v) : v;
      changes.push(
        `${label}: ${show(fmt(settings[key]))} → ${show(fmt(s[key]))}`,
      );
    }
    for (const [k, v] of Object.entries(input.variables ?? {}))
      if ((app.variables[k] ?? "") !== v)
        changes.push(`{${k}}: ${show(app.variables[k])} → ${show(v)}`);
    return { changes, enablesAuto };
  }

  async applyApp(actor: PlayActor, appId: string, input: AppUpdate) {
    const app = await this.play.appRow(actor.workspaceId, appId);
    const update: AppUpdate = { ...input };
    if (input.settings?.ratingRules) {
      const current = await this.engine.ratingRules(app);
      update.settings = {
        ...input.settings,
        ratingRules: current.map((r) => {
          const next = input.settings!.ratingRules!.find(
            (x) => x.rating === r.rating,
          );
          return next
            ? {
                rating: r.rating,
                mode: next.mode ?? r.mode,
                templateId:
                  next.templateId === undefined
                    ? r.templateId
                    : next.templateId,
              }
            : r;
        }) as RatingRule[],
      };
    }
    if (input.variables)
      update.variables = { ...app.variables, ...input.variables };
    await this.play.updateApp(actor, app.id, update);
    return this.settingsForClaude(actor.workspaceId, app.id);
  }

  async previewRules(workspaceId: string, appId: string, rules: RuleInput[]) {
    const current = (await this.play.rules(workspaceId, appId)).data;
    const enablesAuto = rules.some(
      (r) =>
        r.enabled &&
        r.mode === "auto" &&
        !current.some((c) => c.id === r.id && c.mode === "auto" && c.enabled),
    );
    return {
      changes: [
        `Advanced rules: ${current.length} → ${rules.length}`,
        ...rules.map(
          (r, i) =>
            `${i + 1}. ${r.name}${r.enabled ? "" : " (off)"} → ${r.action.type === "template" ? `template, ${r.mode}` : r.action.type}`,
        ),
      ],
      enablesAuto,
    };
  }

  async applyRules(actor: PlayActor, appId: string, rules: RuleInput[]) {
    await this.play.replaceRules(actor, appId, rules);
    return this.settingsForClaude(actor.workspaceId, appId);
  }

  async previewWorkspace(
    workspaceId: string,
    input: { aiMode?: AiMode; slackChannel?: string | null },
  ) {
    const ws = await this.workspace.get(workspaceId);
    const changes: string[] = [];
    if (input.aiMode && input.aiMode !== ws.aiMode)
      changes.push(`AI drafting: ${ws.aiMode} → ${input.aiMode}`);
    if (
      input.slackChannel !== undefined &&
      input.slackChannel !== ws.slackChannel
    )
      changes.push(
        `Slack channel: ${show(ws.slackChannel)} → ${show(input.slackChannel)}`,
      );
    return { changes, enablesAuto: false };
  }

  async applyWorkspace(
    actor: PlayActor,
    input: { aiMode?: AiMode; slackChannel?: string | null },
  ) {
    await this.workspace.update(actor, input);
    return this.workspace.get(actor.workspaceId);
  }

  agentsCanPost(workspaceId: string) {
    return this.workspace.agentsCanPost(workspaceId);
  }
}

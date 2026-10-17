import { Inject, Injectable, Logger } from "@nestjs/common";

import { decide } from "@modules/engine/domain/automation";
import {
  ESCALATION_NOTIFIER,
  EscalationNotifier,
} from "@modules/engine/domain/ports/notifier";
import {
  REPLY_AI,
  ReplyAi,
  ReplyAiError,
} from "@modules/engine/domain/ports/reply-ai";
import { firstName, render } from "@modules/engine/domain/templates";
import { WorkspaceAutomationRow } from "@modules/engine/infrastructure/engine.tables";
import {
  DomainError,
  NotFoundError,
  ValidationError,
} from "@shared/errors/domain-error";

import {
  CLASS_STARS,
  COMMENT_TEMPLATES,
  classifyComment,
  commentFacts,
  commentReplySettings,
} from "../domain/comments";
import { CommentClass, SocialPlatform } from "../domain/social.types";
import {
  SocialAccountRow,
  SocialCommentReplyRow,
  SocialCommentRow,
} from "../infrastructure/social-engine.tables";
import { SocialActor, SocialEngine } from "./social-engine.service";

const DAY = 86_400_000;
const SYNC_WINDOW_DAYS = 14;
const REPLY_MAX = 2200;

export type CommentState =
  | "open"
  | "waiting"
  | "scheduled"
  | "replied"
  | "hidden"
  | "skipped"
  | "failed";

const PLATFORM_NAME: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
};

@Injectable()
export class SocialCommentsService {
  private readonly logger = new Logger(SocialCommentsService.name);

  constructor(
    private readonly engine: SocialEngine,
    @Inject(REPLY_AI) private readonly replyAi: ReplyAi,
    @Inject(ESCALATION_NOTIFIER) private readonly notifier: EscalationNotifier,
  ) {}

  private get repo() {
    return this.engine.repo;
  }

  async sync(account: SocialAccountRow) {
    const creds = this.engine.usable(account);
    const firstSync = !account.commentsSyncedAt;
    const posts = await this.repo.publishedSince(
      account.id,
      new Date(Date.now() - SYNC_WINDOW_DAYS * DAY),
    );
    const byExternal = new Map(posts.map((p) => [p.externalId!, p]));
    let remote;
    try {
      remote = (
        await this.engine.api.comments(
          creds,
          posts.map((p) => p.externalId!),
        )
      ).filter((c) => !c.fromAccount);
    } catch (err) {
      await this.engine.failAccount(account, err);
      throw err;
    }
    const existing = new Map(
      (
        await this.repo.commentsByExternal(
          account.id,
          remote.map((c) => c.id),
        )
      ).map((c) => [c.externalId, c]),
    );
    const settings = this.engine.settingsOf(account);
    const fresh: SocialCommentRow[] = [];
    let hidden = 0;
    for (const c of remote) {
      const row = existing.get(c.id);
      if (row) {
        if (row.hidden !== c.hidden)
          await this.repo.updateComment(row.id, { hidden: c.hidden });
        continue;
      }
      const cls = classifyComment(c.text);
      let inserted = await this.repo.insertComment({
        workspaceId: account.workspaceId,
        accountId: account.id,
        postId: byExternal.get(c.postId)?.id ?? null,
        externalPostId: c.postId,
        externalId: c.id,
        author: c.author,
        authorId: c.authorId,
        text: c.text,
        class: cls,
        commentedAt: c.createdAt,
        hidden: c.hidden,
      });
      if (!inserted) continue;
      if (
        cls === "spam" &&
        settings.comments.hideSpam &&
        account.platform === "facebook" &&
        !c.hidden
      )
        try {
          await this.engine.api.hide(creds, c.id, true);
          inserted = await this.repo.updateComment(inserted.id, {
            hidden: true,
          });
          hidden++;
        } catch (err) {
          this.logger.warn(`Hiding spam failed: ${(err as Error).message}`);
        }
      fresh.push(inserted);
    }
    const drafts = await this.automate(account, fresh, firstSync);
    await this.repo.updateAccount(account.id, { commentsSyncedAt: new Date() });
    return { fetched: remote.length, created: fresh.length, hidden, drafts };
  }

  private async escalate(
    account: SocialAccountRow,
    comment: SocialCommentRow,
    draft: string | null,
    ws: WorkspaceAutomationRow | null,
  ) {
    const webhook = this.engine.workspaceAi.slackWebhook(ws);
    if (
      comment.class !== "complaint" ||
      comment.escalatedAt ||
      !this.engine.settingsOf(account).comments.escalateComplaints ||
      !webhook
    )
      return;
    try {
      await this.notifier.send(webhook, {
        subjectName: `${account.name} on ${PLATFORM_NAME[account.platform]}`,
        author: comment.author,
        stars: CLASS_STARS.complaint,
        text: comment.text,
        draft,
        url: this.engine.url(account.platform, "/comments"),
      });
      await this.repo.updateComment(comment.id, { escalatedAt: new Date() });
    } catch (err) {
      this.logger.warn(`Escalation failed: ${(err as Error).message}`);
    }
  }

  async draft(
    account: SocialAccountRow,
    comment: SocialCommentRow,
    key: string | null,
    avoid: string | null = null,
  ): Promise<{ text: string; source: "ai" | "template" } | null> {
    const settings = this.engine.settingsOf(account);
    const brand = await this.engine.brandFor(account.workspaceId, account);
    const template = COMMENT_TEMPLATES[comment.class];
    const values = {
      first_name: firstName(comment.author),
      business_name: brand.name || account.name,
      phone: "",
    };
    const rendered = template ? render(template, values, "social").text : "";
    if (key)
      try {
        const out = await this.replyAi.draft(key, {
          channel: "social",
          subjectName: brand.name || account.name,
          developerName: null,
          supportEmail: null,
          latestVersion: null,
          review: {
            author: comment.author,
            stars: CLASS_STARS[comment.class],
            text: comment.text,
            language: null,
          },
          template: rendered || null,
          tone: settings.comments.tone,
          translate: true,
          personalize: true,
          avoid,
          maxLength: 500,
        });
        return { text: out.text.slice(0, REPLY_MAX), source: "ai" };
      } catch (err) {
        if (!(err instanceof ReplyAiError)) throw err;
        this.logger.warn(`AI comment reply failed: ${err.message}`);
      }
    return rendered ? { text: rendered, source: "template" } : null;
  }

  private async automate(
    account: SocialAccountRow,
    comments: SocialCommentRow[],
    firstSync: boolean,
  ) {
    if (!comments.length) return 0;
    const settings = commentReplySettings(this.engine.settingsOf(account));
    const {
      key,
      allowance: start,
      ws,
    } = await this.engine.aiKey(account.workspaceId);
    let allowance = start;
    let autoSentToday = await this.repo.autoRepliesSince(
      account.id,
      new Date(Date.now() - DAY),
    );
    const pausedBecause = this.engine.pauseNote(account);
    let drafts = 0;
    for (const comment of [...comments].sort(
      (a, b) => a.commentedAt.getTime() - b.commentedAt.getTime(),
    )) {
      if (comment.hidden || comment.class === "spam") continue;
      const decision = decide({
        facts: commentFacts(comment),
        hasReply: false,
        rules: [],
        settings,
        autoSentToday,
        firstSync,
        now: new Date(),
        pausedBecause,
      });
      if (decision.kind !== "template") {
        await this.escalate(account, comment, null, ws);
        continue;
      }
      const drafted = await this.draft(
        account,
        comment,
        allowance > 0 ? key : null,
      );
      if (drafted?.source === "ai") allowance--;
      if (!drafted) continue;
      const held = firstSync
        ? "Comments found when the account was connected wait for approval."
        : decision.heldBecause;
      const auto = decision.auto && !held;
      await this.repo.insertReply({
        workspaceId: account.workspaceId,
        accountId: account.id,
        commentId: comment.id,
        text: drafted.text,
        source: drafted.source,
        status: auto ? "scheduled" : "pending_approval",
        auto,
        sendAt: auto ? decision.sendAt : null,
        note: held,
      });
      await this.escalate(account, comment, drafted.text, ws);
      if (auto) autoSentToday++;
      drafts++;
    }
    return drafts;
  }

  async send(reply: SocialCommentReplyRow, actor: SocialActor) {
    const text = reply.text.trim();
    if (!text) throw new ValidationError("Write a reply first.");
    if (text.length > REPLY_MAX)
      throw new ValidationError(
        `Replies can be at most ${REPLY_MAX} characters.`,
      );
    const [comment, account] = await Promise.all([
      this.repo.commentById(reply.commentId),
      this.repo.accountById(reply.accountId),
    ]);
    if (!comment || !account)
      throw new NotFoundError("This comment no longer exists.");
    try {
      const out = await this.engine.api.reply(
        this.engine.usable(account),
        comment.externalId,
        text,
      );
      await this.repo.updateComment(comment.id, {
        replyText: text,
        repliedAt: new Date(),
      });
      const row = await this.repo.updateReply(reply.id, {
        text,
        status: "sent",
        sentAt: new Date(),
        sentBy: actor.userId,
        externalId: out.id,
        error: null,
      });
      await this.engine.record(actor, "comment_replied", comment.id, {
        account: account.id,
        class: comment.class,
        auto: reply.auto,
        source: reply.source,
      });
      return row;
    } catch (err) {
      await this.engine.failAccount(account, err);
      const message = this.engine.message(err, "The reply couldn't be sent.");
      if (!(err instanceof DomainError))
        this.logger.error(
          "Comment reply failed",
          err instanceof Error ? err.stack : String(err),
        );
      await this.repo.updateReply(reply.id, {
        text,
        status: "failed",
        error: message,
      });
      throw new ValidationError(message);
    }
  }

  async sendDue(limit = 50) {
    const due = await this.repo.dueReplies(new Date(), limit);
    let sent = 0;
    let failed = 0;
    for (const reply of due) {
      try {
        await this.send(reply, {
          userId: null,
          workspaceId: reply.workspaceId,
          via: "automation",
        });
        sent++;
      } catch {
        failed++;
      }
    }
    return { due: due.length, sent, failed };
  }

  stateOf(
    c: SocialCommentRow,
    latest: SocialCommentReplyRow | undefined,
  ): CommentState {
    if (c.hidden) return "hidden";
    if (c.replyText) return "replied";
    if (
      latest?.status === "pending_approval" ||
      latest?.status === "needs_claude"
    )
      return "waiting";
    if (latest?.status === "scheduled") return "scheduled";
    if (latest?.status === "failed") return "failed";
    if (c.skippedAt) return "skipped";
    return "open";
  }

  async views(rows: SocialCommentRow[]) {
    const replies = await this.repo.repliesFor(rows.map((r) => r.id));
    const posts = new Map<
      string,
      { caption: string; permalink: string | null }
    >();
    for (const id of new Set(rows.map((r) => r.postId).filter(Boolean))) {
      const p = await this.repo.postById(id!);
      if (p) posts.set(p.id, { caption: p.caption, permalink: p.permalink });
    }
    const accounts = new Map<string, SocialAccountRow>();
    for (const id of new Set(rows.map((r) => r.accountId))) {
      const a = await this.repo.accountById(id);
      if (a) accounts.set(a.id, a);
    }
    return rows.map((c) => {
      const mine = replies.filter((r) => r.commentId === c.id);
      const latest = mine.find((r) => r.status !== "discarded");
      const draft =
        latest &&
        ["pending_approval", "needs_claude", "scheduled", "failed"].includes(
          latest.status,
        )
          ? latest
          : null;
      const post = c.postId ? posts.get(c.postId) : undefined;
      const account = accounts.get(c.accountId);
      return {
        id: c.id,
        accountId: c.accountId,
        accountName: account?.username ?? account?.name ?? "",
        platform: account?.platform ?? "instagram",
        postId: c.postId,
        postCaption: post?.caption.slice(0, 140) ?? null,
        postPermalink: post?.permalink ?? null,
        author: c.author,
        text: c.text,
        class: c.class,
        commentedAt: c.commentedAt.toISOString(),
        hidden: c.hidden,
        state: this.stateOf(c, latest),
        reply: c.replyText
          ? { text: c.replyText, at: c.repliedAt?.toISOString() ?? null }
          : null,
        draft: draft
          ? {
              id: draft.id,
              text: draft.text,
              status: draft.status,
              source: draft.source,
              auto: draft.auto,
              note: draft.note,
              sendAt: draft.sendAt?.toISOString() ?? null,
              error: draft.error,
            }
          : null,
        escalatedAt: c.escalatedAt?.toISOString() ?? null,
      };
    });
  }

  async list(
    workspaceId: string,
    f: {
      platform?: SocialPlatform;
      accountId?: string;
      filter?: "open" | "replied" | "all";
      classes?: CommentClass[];
      limit?: number;
    },
  ) {
    const accounts = (await this.repo.accounts(workspaceId, f.platform)).filter(
      (a) => !f.accountId || a.id === f.accountId,
    );
    const ids = accounts.map((a) => a.id);
    const [rows, all] = await Promise.all([
      this.repo.comments(workspaceId, ids, {
        state: f.filter ?? "open",
        classes: f.classes,
        limit: f.limit,
      }),
      this.repo.commentCounts(ids),
    ]);
    const counts = { open: 0, waiting: 0 };
    for (const c of all.values()) {
      counts.open += c.open;
      counts.waiting += c.waiting;
    }
    return { counts, data: await this.views(rows) };
  }

  async commentRow(workspaceId: string, id: string) {
    const c = await this.repo.comment(workspaceId, id);
    if (!c) throw new NotFoundError("This comment doesn't exist.");
    return c;
  }

  async view(workspaceId: string, id: string) {
    return (await this.views([await this.commentRow(workspaceId, id)]))[0]!;
  }

  private async upsertDraft(
    actor: SocialActor,
    comment: SocialCommentRow,
    text: string,
    source: "manual" | "claude" | "ai" | "template",
  ) {
    const active = await this.repo.activeReply(comment.id);
    if (active)
      return this.repo.updateReply(active.id, {
        text,
        source,
        status: "pending_approval",
        auto: false,
        sendAt: null,
        note: null,
        error: null,
      });
    return this.repo.insertReply({
      workspaceId: comment.workspaceId,
      accountId: comment.accountId,
      commentId: comment.id,
      text,
      source,
      status: "pending_approval",
      createdBy: actor.userId,
    });
  }

  async saveDraft(
    actor: SocialActor,
    id: string,
    input: { text: string; source?: "manual" | "claude" },
  ) {
    const comment = await this.commentRow(actor.workspaceId, id);
    if (!input.text.trim()) throw new ValidationError("Write a reply first.");
    await this.upsertDraft(
      actor,
      comment,
      input.text.trim(),
      input.source ?? "manual",
    );
    return this.view(actor.workspaceId, id);
  }

  async aiDraft(actor: SocialActor, id: string, rewrite = false) {
    const comment = await this.commentRow(actor.workspaceId, id);
    const account = await this.repo.accountById(comment.accountId);
    if (!account) throw new NotFoundError("This account isn't connected.");
    const { key, allowance } = await this.engine.aiKey(actor.workspaceId);
    const active = await this.repo.activeReply(comment.id);
    const drafted = await this.draft(
      account,
      comment,
      allowance > 0 ? key : null,
      rewrite ? (active?.text ?? null) : null,
    );
    if (!drafted)
      throw new ValidationError("There's nothing to draft for this comment.");
    await this.upsertDraft(actor, comment, drafted.text, drafted.source);
    return this.view(actor.workspaceId, id);
  }

  async replyNow(
    actor: SocialActor,
    id: string,
    input: { text: string; source?: "manual" | "claude" },
  ) {
    const comment = await this.commentRow(actor.workspaceId, id);
    const reply = await this.upsertDraft(
      actor,
      comment,
      input.text.trim(),
      input.source ?? "manual",
    );
    await this.send(reply, actor);
    return this.view(actor.workspaceId, id);
  }

  async approve(actor: SocialActor, replyId: string, text?: string) {
    const reply = await this.repo.reply(actor.workspaceId, replyId);
    if (!reply) throw new NotFoundError("This draft doesn't exist.");
    if (
      !["pending_approval", "needs_claude", "scheduled", "failed"].includes(
        reply.status,
      )
    )
      throw new ValidationError("This reply was already handled.");
    const row = text?.trim()
      ? await this.repo.updateReply(reply.id, { text: text.trim() })
      : reply;
    await this.send(row, actor);
    return this.view(actor.workspaceId, reply.commentId);
  }

  async approveAll(actor: SocialActor, replyIds: string[]) {
    let sent = 0;
    const failed: { id: string; error: string }[] = [];
    for (const id of replyIds) {
      try {
        await this.approve(actor, id);
        sent++;
      } catch (err) {
        failed.push({ id, error: this.engine.message(err, "Failed.") });
      }
    }
    return { sent, failed };
  }

  async discard(actor: SocialActor, replyId: string) {
    const reply = await this.repo.reply(actor.workspaceId, replyId);
    if (!reply) throw new NotFoundError("This draft doesn't exist.");
    await this.repo.updateReply(reply.id, { status: "discarded" });
    await this.engine.record(actor, "comment_draft_discarded", reply.commentId);
    return this.view(actor.workspaceId, reply.commentId);
  }

  async hide(actor: SocialActor, id: string, hidden: boolean) {
    const comment = await this.commentRow(actor.workspaceId, id);
    const account = await this.repo.accountById(comment.accountId);
    if (!account) throw new NotFoundError("This account isn't connected.");
    try {
      await this.engine.api.hide(
        this.engine.usable(account),
        comment.externalId,
        hidden,
      );
    } catch (err) {
      await this.engine.failAccount(account, err);
      throw new ValidationError(
        this.engine.message(err, "The comment couldn't be updated."),
      );
    }
    await this.repo.updateComment(comment.id, { hidden });
    await this.engine.record(
      actor,
      hidden ? "comment_hidden" : "comment_unhidden",
      comment.id,
    );
    return this.view(actor.workspaceId, id);
  }

  async skip(actor: SocialActor, id: string, undo = false) {
    const comment = await this.commentRow(actor.workspaceId, id);
    await this.repo.updateComment(comment.id, {
      skippedAt: undo ? null : new Date(),
    });
    if (!undo) {
      const active = await this.repo.activeReply(comment.id);
      if (active)
        await this.repo.updateReply(active.id, { status: "discarded" });
    }
    return this.view(actor.workspaceId, id);
  }
}

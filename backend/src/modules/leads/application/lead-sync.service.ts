import { Inject, Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { WorkspaceAiService } from "@modules/engine/application/workspace-ai.service";
import {
  ESCALATION_NOTIFIER,
  EscalationNotifier,
} from "@modules/engine/domain/ports/notifier";
import { MetaConnectionService } from "@modules/meta/application/meta-connection.service";
import {
  LeadRecord,
  META_ADS,
  MetaAds,
} from "@modules/meta/domain/ports/meta-ads";
import { MetaConnectionRepository } from "@modules/meta/infrastructure/meta-connection.repository";
import { AppConfig, appUrl } from "@shared/config/app-config";

import { contactOf } from "../domain/lead-fields";
import {
  ALERT_LIMIT,
  isPermissionError,
  LEADS_PERMISSION,
  permissionFixes,
  shouldAlert,
  sinceFor,
  SyncErrorCode,
} from "../domain/lead-sync";
import { LeadSyncResult, LeadSyncView } from "../domain/lead.types";
import { LeadScheduler } from "../infrastructure/lead-scheduler";
import { LeadsRepository } from "../infrastructure/leads.repository";
import { MetaLeadFormRow, MetaLeadRow } from "../infrastructure/leads.tables";

const PERMISSION_MESSAGE =
  "TreeVook can't read your leads because the leads_retrieval permission isn't granted to your Meta connection.";

class SyncProblem extends Error {
  constructor(
    readonly code: SyncErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export interface TrackFormInput {
  formId: string;
  pageId: string;
  name: string;
  planId: string | null;
  questions: { key: string; label: string; type: string }[];
}

@Injectable()
export class LeadSyncService {
  private readonly logger = new Logger(LeadSyncService.name);

  constructor(
    private readonly repo: LeadsRepository,
    private readonly connections: MetaConnectionService,
    private readonly connectionRows: MetaConnectionRepository,
    @Inject(META_ADS) private readonly ads: MetaAds,
    private readonly workspaceAi: WorkspaceAiService,
    @Inject(ESCALATION_NOTIFIER) private readonly notifier: EscalationNotifier,
    private readonly scheduler: LeadScheduler,
    @Inject(ConfigService) private readonly config: AppConfig,
  ) {}

  leadUrl(id: string): string {
    return `${appUrl(this.config)}/leads?lead=${id}`;
  }

  async trackCreatedForm(
    workspaceId: string,
    input: TrackFormInput,
  ): Promise<void> {
    await this.repo.upsertForm({
      workspaceId,
      formId: input.formId,
      pageId: input.pageId,
      name: input.name,
      source: "created",
      planId: input.planId,
      status: "ACTIVE",
      questions: input.questions,
    });
    await this.schedule(workspaceId);
  }

  async view(workspaceId: string): Promise<LeadSyncView> {
    const [state, connection, forms] = await Promise.all([
      this.repo.syncState(workspaceId),
      this.connectionRows.find(workspaceId),
      this.repo.forms(workspaceId),
    ]);
    const granted =
      connection?.grantedScopes.includes(LEADS_PERMISSION) ?? false;
    const errorCode = (state?.errorCode as SyncErrorCode | null) ?? null;
    return {
      status: !state?.lastRunAt ? "never" : errorCode ? "error" : "ok",
      lastRunAt: state?.lastRunAt?.toISOString() ?? null,
      lastSuccessAt: state?.lastSuccessAt?.toISOString() ?? null,
      errorCode,
      error: state?.error ?? null,
      fixes:
        errorCode === "permission_missing" || (connection && !granted)
          ? permissionFixes(connection?.method ?? null)
          : [],
      permissionGranted: granted,
      forms: forms.length,
    };
  }

  async sync(workspaceId: string): Promise<LeadSyncResult> {
    const startedAt = new Date();
    try {
      const result = await this.run(workspaceId);
      await this.repo.saveSync(workspaceId, {
        lastRunAt: startedAt,
        lastSuccessAt: startedAt,
        errorCode: null,
        error: null,
      });
      return result;
    } catch (err) {
      const problem = this.problemFrom(err);
      if (problem.code === "failed")
        this.logger.warn(
          `Lead sync failed for ${workspaceId}: ${problem.message}`,
        );
      await this.repo.saveSync(workspaceId, {
        lastRunAt: startedAt,
        errorCode: problem.code,
        error: problem.message,
      });
      return {
        status: "error",
        forms: 0,
        fetched: 0,
        created: 0,
        alerted: 0,
        errorCode: problem.code,
        error: problem.message,
      };
    }
  }

  async reconcile(): Promise<{ scheduled: number; removed: number }> {
    const active = await this.connectionRows.listActive();
    const activeIds = new Set(active.map((c) => c.workspaceId));
    const withForms = new Set(await this.repo.workspacesWithForms());
    let scheduled = 0;
    for (const connection of active) {
      let has = withForms.has(connection.workspaceId);
      if (!has && connection.grantedScopes.includes(LEADS_PERMISSION)) {
        try {
          has = (await this.discover(connection.workspaceId)) > 0;
        } catch {
          has = false;
        }
      }
      if (has) {
        await this.scheduler.ensure(connection.workspaceId);
        scheduled++;
      }
    }
    let removed = 0;
    for (const workspaceId of await this.scheduler.scheduled()) {
      if (!activeIds.has(workspaceId)) {
        await this.scheduler.remove(workspaceId);
        removed++;
      }
    }
    return { scheduled, removed };
  }

  private async schedule(workspaceId: string): Promise<void> {
    try {
      await this.scheduler.ensure(workspaceId);
    } catch (err) {
      this.logger.warn(
        `Couldn't schedule lead sync for ${workspaceId}: ${(err as Error).message}`,
      );
    }
  }

  private async discover(workspaceId: string): Promise<number> {
    const { pageId, pageToken } = await this.pageAccess(workspaceId);
    return (await this.discoverForms(workspaceId, pageId, pageToken)).length;
  }

  private async pageAccess(
    workspaceId: string,
  ): Promise<{ pageId: string; pageToken: string }> {
    const connection = await this.connectionRows.find(workspaceId);
    if (!connection || connection.status !== "active")
      throw new SyncProblem(
        "not_connected",
        "Connect your Meta account to receive leads.",
      );
    if (!connection.grantedScopes.includes(LEADS_PERMISSION))
      throw new SyncProblem("permission_missing", PERMISSION_MESSAGE);
    const { data } = await this.connections.listAssets(workspaceId);
    const page = data.find((a) => a.kind === "page" && a.isPrimary);
    if (!page)
      throw new SyncProblem(
        "no_page",
        "Select a Facebook Page in Setup to receive leads from its instant forms.",
      );
    const token = await this.connections.accessToken(workspaceId);
    const pageToken = await this.ads.pageAccessToken(token, page.externalId);
    return { pageId: page.externalId, pageToken };
  }

  private async discoverForms(
    workspaceId: string,
    pageId: string,
    pageToken: string,
  ): Promise<MetaLeadFormRow[]> {
    const found = await this.ads.leadForms(pageToken, pageId);
    for (const form of found)
      await this.repo.upsertForm({
        workspaceId,
        formId: form.id,
        pageId,
        name: form.name,
        source: "discovered",
        status: form.status,
        questions: form.questions,
      });
    return (await this.repo.forms(workspaceId)).filter(
      (f) => f.pageId === pageId,
    );
  }

  private async run(workspaceId: string): Promise<LeadSyncResult> {
    const { pageId, pageToken } = await this.pageAccess(workspaceId);
    const forms = await this.discoverForms(workspaceId, pageId, pageToken);
    let fetched = 0;
    let created = 0;
    const fresh: { lead: MetaLeadRow; form: MetaLeadFormRow }[] = [];
    for (const form of forms) {
      if (form.status === "DELETED") continue;
      const leads = await this.ads.leads(
        pageToken,
        form.formId,
        sinceFor(form.lastLeadAt),
      );
      fetched += leads.length;
      const inserted = await this.repo.insertLeads(
        leads.map((l) => this.row(workspaceId, l)),
      );
      created += inserted.length;
      const newest = leads.reduce<Date | null>((max, l) => {
        const t = new Date(l.createdTime);
        return !max || t > max ? t : max;
      }, form.lastLeadAt);
      await this.repo.updateForm(form.id, {
        lastLeadAt: newest,
        lastSyncedAt: new Date(),
      });
      for (const lead of inserted)
        if (shouldAlert(lead.createdTime, form.createdAt))
          fresh.push({ lead, form });
    }
    if (forms.length) await this.schedule(workspaceId);
    const alerted = await this.alert(workspaceId, fresh);
    return {
      status: "ok",
      forms: forms.length,
      fetched,
      created,
      alerted,
      errorCode: null,
      error: null,
    };
  }

  private row(workspaceId: string, lead: LeadRecord) {
    return {
      workspaceId,
      leadId: lead.id,
      formId: lead.formId,
      adId: lead.adId,
      adName: lead.adName,
      adSetId: lead.adSetId,
      adSetName: lead.adSetName,
      campaignId: lead.campaignId,
      campaignName: lead.campaignName,
      createdTime: new Date(lead.createdTime),
      fieldData: lead.fieldData,
    };
  }

  private async alert(
    workspaceId: string,
    fresh: { lead: MetaLeadRow; form: MetaLeadFormRow }[],
  ): Promise<number> {
    if (!fresh.length) return 0;
    const settings = await this.workspaceAi.settings(workspaceId);
    const webhook = this.workspaceAi.slackWebhook(settings);
    if (!webhook || settings?.notifyNewLeads === false) return 0;
    const sorted = [...fresh].sort(
      (a, b) => a.lead.createdTime.getTime() - b.lead.createdTime.getTime(),
    );
    let sent = 0;
    try {
      for (const { lead, form } of sorted.slice(0, ALERT_LIMIT)) {
        const contact = contactOf(lead.fieldData, form.questions);
        await this.notifier.alert(webhook, {
          title: `New lead: ${contact.name ?? "someone filled in your form"}`,
          text: [
            `Phone: ${contact.phone ?? "not given"}`,
            contact.email ? `Email: ${contact.email}` : null,
            `Campaign: ${lead.campaignName ?? "unknown"}`,
            `Form: ${form.name}`,
          ]
            .filter(Boolean)
            .join("\n"),
          url: this.leadUrl(lead.id),
        });
        sent++;
      }
      const rest = sorted.length - ALERT_LIMIT;
      if (rest > 0) {
        await this.notifier.alert(webhook, {
          title: `${rest} more new lead${rest === 1 ? "" : "s"}`,
          text: "Open TreeVook to see every new lead.",
          url: `${appUrl(this.config)}/leads?status=new`,
        });
        sent++;
      }
    } catch (err) {
      this.logger.warn(`Lead alert failed: ${(err as Error).message}`);
    }
    return sent;
  }

  private problemFrom(err: unknown): SyncProblem {
    if (err instanceof SyncProblem) return err;
    if (isPermissionError(err))
      return new SyncProblem("permission_missing", PERMISSION_MESSAGE);
    return new SyncProblem(
      "failed",
      err instanceof Error
        ? err.message
        : "Something went wrong while reading your leads.",
    );
  }
}

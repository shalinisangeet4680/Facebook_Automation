import { getQueueToken } from "@nestjs/bullmq";
import { NestFastifyApplication } from "@nestjs/platform-fastify";
import { Queue } from "bullmq";
import { eq } from "drizzle-orm";
import Redis from "ioredis";

import { otpChallenges } from "@modules/auth/infrastructure/auth.tables";
import { ESCALATION_NOTIFIER } from "@modules/engine/domain/ports/notifier";
import { MockNotifier } from "@modules/engine/infrastructure/slack.notifier";
import { users, workspaces } from "@modules/iam/infrastructure/iam.tables";
import { LeadSyncService } from "@modules/leads/application/lead-sync.service";
import { schedulerId } from "@modules/leads/domain/lead-sync";
import {
  advanceMockLeads,
  mockLeadForm,
  resetMockAds,
} from "@modules/meta/infrastructure/mock-meta.ads";
import { DATABASE, Database } from "@shared/database/database";
import { QUEUES } from "@shared/queue/queue.constants";

import { createApp } from "../src/app.factory";
import { call } from "./helpers";

const OWNER = "9000000071";
const OTHER = "9000000072";
const NO_LEADS = "9000000073";
const WEBHOOK = "https://hooks.slack.com/services/T000/B000/leadsowner";

type Json = Record<string, any>;

const brief = {
  goal: "instant_leads",
  dailyBudget: 600,
  locations: { cities: [{ key: "1035921", name: "Patna", radiusKm: 25 }] },
  audienceNotes: "clinic owners and doctors",
  offer: "Free demo of our clinic management app",
  creative: { imageUrl: "https://arogyasystem.com/og.png" },
  language: "English",
  leadForm: {
    questions: ["FULL_NAME", "PHONE", "EMAIL", "CITY"],
    privacyPolicyUrl: "https://arogyasystem.com/privacy",
  },
};

describe("Lead form ads and the leads inbox", () => {
  let app: NestFastifyApplication;
  let db: Database;
  let queue: Queue;
  let notifier: MockNotifier;
  let owner: Record<string, string>;
  let other: Record<string, string>;
  let noLeads: Record<string, string>;
  const workspaceIds: string[] = [];
  let planId: string;
  let campaignId: string;
  let formId: string;

  async function signIn(phone: string, token = `EAA${"x".repeat(40)}`) {
    await db
      .delete(otpChallenges)
      .where(eq(otpChallenges.phone, `+91${phone}`));
    const mobile = { "x-client": "mobile" };
    await call(app, "POST", "/api/v1/auth/otp/request", {
      headers: mobile,
      body: { phone },
    });
    const res = await call(app, "POST", "/api/v1/auth/otp/verify", {
      headers: mobile,
      body: { phone, code: "123456" },
    });
    const headers = {
      "x-client": "mobile",
      authorization: `Bearer ${res.body.accessToken as string}`,
    };
    const connected = await call(app, "POST", "/api/v1/meta/connection", {
      headers,
      body: { token },
    });
    expect(connected.statusCode).toBe(200);
    const user = await db.query.users.findFirst({
      where: eq(users.phone, `+91${phone}`),
    });
    const ws = await db.query.workspaces.findFirst({
      where: eq(workspaces.ownerId, user!.id),
    });
    workspaceIds.push(ws!.id);
    return headers;
  }

  const leads = (headers: Record<string, string>, query = "") =>
    call(app, "GET", `/api/v1/ads/leads${query}`, { headers });
  const sync = (headers: Record<string, string>) =>
    call(app, "POST", "/api/v1/ads/leads/sync", { headers });
  const exportCsv = (headers: Record<string, string>, query = "") =>
    app.inject({
      method: "GET",
      url: `/api/v1/ads/leads/export.csv${query}`,
      headers,
    });
  const alertsFor = (url: string) =>
    notifier.alerts.filter((a) => a.webhookUrl === url);

  beforeAll(async () => {
    const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
    const keys = await redis.keys("throttle:*");
    if (keys.length) await redis.del(...keys);
    await redis.quit();
    resetMockAds();
    app = await createApp();
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    db = app.get(DATABASE);
    queue = app.get<Queue>(getQueueToken(QUEUES.LEADS));
    notifier = app.get<MockNotifier>(ESCALATION_NOTIFIER);
    owner = await signIn(OWNER);
    other = await signIn(OTHER);
    noLeads = await signIn(NO_LEADS, `EAA${"x".repeat(32)}noleads`);
    const limits = await call(app, "PUT", "/api/v1/settings/workspace", {
      headers: owner,
      body: {
        name: "Arogya System",
        maxDailyBudget: 3000,
        monthlyBudget: null,
        targetCostPerResult: null,
      },
    });
    expect(limits.statusCode).toBe(200);
    const slack = await call(app, "PUT", "/api/v1/automation/settings", {
      headers: owner,
      body: { slackWebhook: WEBHOOK },
    });
    expect(slack.statusCode).toBe(200);
    expect(slack.body).toMatchObject({
      slackConnected: true,
      notifyNewLeads: true,
    });
  });

  afterAll(async () => {
    for (const id of workspaceIds)
      await queue.removeJobScheduler(schedulerId(id));
    for (const phone of [OWNER, OTHER, NO_LEADS]) {
      const user = await db.query.users.findFirst({
        where: eq(users.phone, `+91${phone}`),
      });
      if (user) {
        await db.delete(workspaces).where(eq(workspaces.ownerId, user.id));
        await db.delete(users).where(eq(users.id, user.id));
      }
      await db
        .delete(otpChallenges)
        .where(eq(otpChallenges.phone, `+91${phone}`));
    }
    await app.close();
  });

  it("generates an instant form plan that needs no Pixel", async () => {
    const res = await call(app, "POST", "/api/v1/campaign-plans/generate", {
      headers: owner,
      body: brief,
    });
    expect(res.statusCode, JSON.stringify(res.body)).toBe(201);
    expect(res.body).toMatchObject({ ai: true, usedTemplate: false });
    planId = res.body.id as string;

    const detail = await call(app, "GET", `/api/v1/campaign-plans/${planId}`, {
      headers: owner,
    });
    const plan = (detail.body as Json).plan as Json;
    expect(plan).toMatchObject({
      goal: "instant_leads",
      conversionEvent: null,
      creative: {
        callToAction: "SIGN_UP",
        linkUrl: "https://www.facebook.com/1301000000000001",
      },
      leadForm: {
        locale: "EN_US",
        questions: ["FULL_NAME", "PHONE", "EMAIL", "CITY"],
        privacyPolicyUrl: "https://arogyasystem.com/privacy",
        intro: { headline: "Free demo of our clinic management app" },
        thankYou: {
          button: {
            type: "website",
            url: "https://www.facebook.com/1301000000000001",
          },
        },
      },
    });
    expect(plan.leadForm.customQuestions).toHaveLength(1);
    expect((detail.body as Json).options).toMatchObject({
      leadFormCallsToAction: expect.arrayContaining(["SIGN_UP", "GET_QUOTE"]),
    });
    expect(
      ((detail.body as Json).options.goals as Json[]).find(
        (g) => g.name === "instant_leads",
      ),
    ).toEqual({ name: "instant_leads", needsPixel: false, instantForm: true });

    const tracking = await call(app, "GET", "/api/v1/ads/tracking", {
      headers: owner,
    });
    expect(
      (tracking.body.goals as Json[]).find((g) => g.goal === "instant_leads"),
    ).toMatchObject({ ready: true, needs: [] });
  });

  it("rejects incomplete lead forms", async () => {
    const noPrivacy = await call(
      app,
      "POST",
      "/api/v1/campaign-plans/generate",
      {
        headers: owner,
        body: { ...brief, leadForm: { questions: ["FULL_NAME", "PHONE"] } },
      },
    );
    expect(noPrivacy.statusCode).toBe(400);
    expect(JSON.stringify(noPrivacy.body)).toContain("privacy policy");

    const detail = await call(app, "GET", `/api/v1/campaign-plans/${planId}`, {
      headers: owner,
    });
    const plan = (detail.body as Json).plan as Json;
    const bad = await call(app, "PUT", `/api/v1/campaign-plans/${planId}`, {
      headers: owner,
      body: {
        plan: {
          ...plan,
          leadForm: { ...plan.leadForm, questions: ["FULL_NAME", "CITY"] },
        },
      },
    });
    expect(bad.statusCode).toBe(400);
    expect(JSON.stringify(bad.body)).toContain("phone number or an email");

    const edited = await call(app, "PUT", `/api/v1/campaign-plans/${planId}`, {
      headers: owner,
      body: {
        plan: {
          ...plan,
          creative: { ...plan.creative, callToAction: "GET_QUOTE" },
          leadForm: {
            ...plan.leadForm,
            customQuestions: [
              ...plan.leadForm.customQuestions,
              { label: "Clinic name", type: "short_answer", options: [] },
            ],
          },
        },
      },
    });
    expect(edited.statusCode).toBe(200);
    expect((edited.body as Json).plan.leadForm.customQuestions).toHaveLength(2);
  });

  it("creates the form on the Page and points the ad at it", async () => {
    const created = await call(
      app,
      "POST",
      `/api/v1/campaign-plans/${planId}/create`,
      { headers: owner },
    );
    expect(created.statusCode).toBe(200);
    expect(created.body.status).toBe("created");
    const meta = created.body.meta as Json;
    formId = meta.leadFormId as string;
    campaignId = meta.campaignId as string;
    expect(formId).toMatch(/^\d+$/);

    const form = mockLeadForm(formId)!;
    expect(form.status).toBe("ACTIVE");
    expect(form.spec).toMatchObject({
      pageId: "1301000000000001",
      questions: ["FULL_NAME", "PHONE", "EMAIL", "CITY"],
      privacyPolicyUrl: "https://arogyasystem.com/privacy",
      customQuestions: [
        { key: "custom_1" },
        { key: "custom_2", label: "Clinic name", options: [] },
      ],
    });

    const campaign = await call(
      app,
      "GET",
      `/api/v1/ads/campaigns/${campaignId}`,
      { headers: owner },
    );
    expect(campaign.statusCode).toBe(200);
    expect((campaign.body as Json).campaign.objective).toBe("OUTCOME_LEADS");
    expect((campaign.body as Json).adSets[0]).toMatchObject({
      optimizationGoal: "LEAD_GENERATION",
    });
    expect((campaign.body as Json).ads[0].creative).toMatchObject({
      callToAction: "GET_QUOTE",
      leadFormId: formId,
    });

    expect(
      await queue.getJobScheduler(schedulerId(workspaceIds[0]!)),
    ).toMatchObject({ every: 15 * 60_000 });

    const audit = await call(app, "GET", "/api/v1/audit-events?limit=5", {
      headers: owner,
    });
    expect(
      (audit.body.data as Json[]).find(
        (e) => e.action === "plan.created_in_meta",
      ),
    ).toMatchObject({ data: { leadFormId: formId } });
  });

  it("syncs new leads once, alerts Slack and skips the backlog", async () => {
    const first = await sync(owner);
    expect(first.statusCode).toBe(200);
    expect(first.body).toMatchObject({ status: "ok", forms: 2, alerted: 0 });
    expect(first.body.created).toBeGreaterThan(20);
    expect(alertsFor(WEBHOOK)).toHaveLength(0);

    advanceMockLeads(61 * 60_000);
    const second = await sync(owner);
    expect(second.body.status).toBe("ok");
    const mine = await leads(owner, `?campaignId=${campaignId}`);
    expect(mine.body.data).toHaveLength(3);
    const alerts = alertsFor(WEBHOOK);
    const formAlerts = alerts.filter((a) =>
      a.alert.text.includes("Free demo of our clinic"),
    );
    expect(formAlerts).toHaveLength(3);
    const lead = (mine.body.data as Json[])[0]!;
    const alert = formAlerts.find((a) =>
      a.alert.url.endsWith(`/leads?lead=${lead.id as string}`),
    )!;
    expect(alert.alert.title).toBe(`New lead: ${lead.name as string}`);
    expect(alert.alert.text).toContain(`Phone: ${lead.phone as string}`);
    expect(alert.alert.url).toBe(
      `http://localhost:3200/leads?lead=${lead.id as string}`,
    );

    const again = await sync(owner);
    expect(again.body).toMatchObject({ status: "ok", created: 0, alerted: 0 });
    expect(again.body.fetched).toBeGreaterThan(0);
    expect(alertsFor(WEBHOOK)).toHaveLength(alerts.length);
  });

  it("lists, filters, pages and searches leads", async () => {
    const mine = await leads(owner, `?campaignId=${campaignId}`);
    const rows = mine.body.data as Json[];
    expect(rows[0]).toMatchObject({
      status: "new",
      campaign: { id: campaignId },
      form: { id: formId },
    });
    expect(rows[0]!.phone).toMatch(/^\+9198\d{8}$/);
    expect(rows[0]!.email).toContain("@example.com");
    expect(rows[0]!.answers.map((a: Json) => a.label)).toEqual([
      "When is the best time to call you?",
      "Clinic name",
    ]);
    const times = rows.map((r) => Date.parse(r.createdTime as string));
    expect([...times].sort((a, b) => b - a)).toEqual(times);

    const page1 = await leads(owner, "?limit=10");
    expect(page1.body.data).toHaveLength(10);
    expect(page1.body.nextCursor).toBeTruthy();
    const page2 = await leads(
      owner,
      `?limit=10&cursor=${page1.body.nextCursor as string}`,
    );
    const ids1 = new Set((page1.body.data as Json[]).map((r) => r.id));
    expect((page2.body.data as Json[]).some((r) => ids1.has(r.id))).toBe(false);
    expect((await leads(owner, "?cursor=not-a-cursor")).statusCode).toBe(400);

    const name = (rows[0]!.name as string).split(" ")[0]!;
    const found = await leads(owner, `?q=${encodeURIComponent(name)}`);
    expect(found.statusCode).toBe(200);
    expect(
      (found.body.data as Json[]).every((r) =>
        (r.name as string).includes(name),
      ),
    ).toBe(true);
    expect((await leads(owner, "?q=%25_nobody_%25")).body.data).toHaveLength(0);
    expect((await leads(owner, "?status=sold")).statusCode).toBe(400);

    const summary = await call(app, "GET", "/api/v1/ads/leads/summary", {
      headers: owner,
    });
    expect(summary.body).toMatchObject({
      sync: {
        status: "ok",
        permissionGranted: true,
        forms: 2,
        errorCode: null,
      },
    });
    expect(summary.body.new).toBe(summary.body.total);
    expect(summary.body.campaigns).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: campaignId })]),
    );
  });

  it("updates a lead's status and notes with an audit trail", async () => {
    const mine = await leads(owner, `?campaignId=${campaignId}`);
    const id = (mine.body.data as Json[])[0]!.id as string;
    const patched = await call(app, "PATCH", `/api/v1/ads/leads/${id}`, {
      headers: owner,
      body: { status: "contacted", notes: "Called, wants a demo on Monday" },
    });
    expect(patched.statusCode).toBe(200);
    expect(patched.body).toMatchObject({
      status: "contacted",
      notes: "Called, wants a demo on Monday",
    });
    const one = await call(app, "GET", `/api/v1/ads/leads/${id}`, {
      headers: owner,
    });
    expect(one.body.status).toBe("contacted");

    const contacted = await leads(owner, "?status=contacted");
    expect((contacted.body.data as Json[]).map((r) => r.id)).toEqual([id]);
    expect(
      (await leads(owner, "?q=wants%20a%20demo")).body.data as Json[],
    ).toHaveLength(1);

    const bad = await call(app, "PATCH", `/api/v1/ads/leads/${id}`, {
      headers: owner,
      body: { status: "sold" },
    });
    expect(bad.statusCode).toBe(400);

    const audit = await call(app, "GET", "/api/v1/audit-events?limit=5", {
      headers: owner,
    });
    const event = (audit.body.data as Json[]).find(
      (e) => e.action === "lead.updated",
    )!;
    expect(event).toMatchObject({
      target: id,
      data: { fields: ["status", "notes"], from: "new", to: "contacted" },
    });
    expect(JSON.stringify(event)).not.toContain("Monday");
    expect(JSON.stringify(event)).not.toContain("+91");
  });

  it("exports the filtered leads as a safe CSV", async () => {
    const res = await exportCsv(owner, `?campaignId=${campaignId}`);
    expect(res.statusCode).toBe(200);
    expect(res.headers["content-type"]).toContain("text/csv");
    expect(res.headers["content-disposition"]).toMatch(
      /attachment; filename="leads-\d{4}-\d{2}-\d{2}\.csv"/,
    );
    const lines = res.body.replace(/^﻿/, "").trim().split("\r\n");
    expect(lines[0]).toBe(
      "Created,Name,Phone,Email,City,Other answers,Status,Notes,Campaign,Ad set,Ad,Form,Lead ID",
    );
    expect(lines).toHaveLength(4);
    expect(lines.slice(1).every((l) => l.includes(",'+9198"))).toBe(true);
    expect(res.body).toContain('"Called, wants a demo on Monday"');

    const contacted = await exportCsv(owner, "?status=contacted");
    expect(contacted.body.trim().split("\r\n")).toHaveLength(2);
  });

  it("respects the new-lead notification setting", async () => {
    const off = await call(app, "PUT", "/api/v1/automation/settings", {
      headers: owner,
      body: { notifyNewLeads: false },
    });
    expect(off.body.notifyNewLeads).toBe(false);
    const before = alertsFor(WEBHOOK).length;
    advanceMockLeads(20 * 60_000);
    const res = await sync(owner);
    expect(res.body.created).toBeGreaterThanOrEqual(1);
    expect(res.body.alerted).toBe(0);
    expect(alertsFor(WEBHOOK)).toHaveLength(before);
    await call(app, "PUT", "/api/v1/automation/settings", {
      headers: owner,
      body: { notifyNewLeads: true },
    });
  });

  it("explains how to fix a missing leads_retrieval permission", async () => {
    const res = await sync(noLeads);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      status: "error",
      errorCode: "permission_missing",
      created: 0,
    });
    expect(res.body.error).toContain("leads_retrieval");
    const summary = await call(app, "GET", "/api/v1/ads/leads/summary", {
      headers: noLeads,
    });
    expect((summary.body as Json).sync).toMatchObject({
      status: "error",
      errorCode: "permission_missing",
      permissionGranted: false,
    });
    expect(((summary.body as Json).sync.fixes as string[]).join(" ")).toContain(
      "leads_retrieval",
    );
    expect((await leads(noLeads)).body.data).toHaveLength(0);
  });

  it("keeps each workspace's leads private", async () => {
    const mine = await leads(owner, "?status=contacted");
    const id = (mine.body.data as Json[])[0]!.id as string;
    expect(
      (await call(app, "GET", `/api/v1/ads/leads/${id}`, { headers: other }))
        .statusCode,
    ).toBe(404);
    expect(
      (
        await call(app, "PATCH", `/api/v1/ads/leads/${id}`, {
          headers: other,
          body: { status: "won" },
        })
      ).statusCode,
    ).toBe(404);
    expect((await leads(other)).body.data).toHaveLength(0);
    expect(
      (await exportCsv(other)).body.replace(/^﻿/, "").trim().split("\r\n"),
    ).toHaveLength(1);

    const theirs = await sync(other);
    expect(theirs.body.status).toBe("ok");
    const shared = (await leads(other, `?campaignId=${campaignId}`)).body
      .data as Json[];
    expect(shared.every((r) => r.status === "new" && r.id !== id)).toBe(true);
    const ownerLead = await call(app, "GET", `/api/v1/ads/leads/${id}`, {
      headers: owner,
    });
    expect(ownerLead.body.status).toBe("contacted");
  });

  it("schedules a sync for every connected workspace with forms", async () => {
    const result = await app.get(LeadSyncService).reconcile();
    expect(result.scheduled).toBeGreaterThanOrEqual(2);
    expect(
      await queue.getJobScheduler(schedulerId(workspaceIds[1]!)),
    ).toBeTruthy();
    expect(
      await queue.getJobScheduler(schedulerId(workspaceIds[2]!)),
    ).toBeFalsy();
  });
});

import {
  Alert,
  Escalation,
  EscalationNotifier,
} from "../domain/ports/notifier";

export class SlackNotifier implements EscalationNotifier {
  async send(webhookUrl: string, e: Escalation): Promise<void> {
    const stars = "★".repeat(e.stars) + "☆".repeat(5 - e.stars);
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: `${stars} review for ${e.subjectName}`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*${stars} ${e.subjectName}* · ${e.author || "A Google user"}\n>${(e.text || "(rating only)").replace(/\n/g, "\n>")}`,
            },
          },
          ...(e.draft
            ? [
                {
                  type: "section",
                  text: { type: "mrkdwn", text: `*AI draft*\n${e.draft}` },
                },
              ]
            : []),
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "Open in TreeVook" },
                url: e.url,
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Slack returned ${res.status}`);
  }

  async alert(webhookUrl: string, a: Alert): Promise<void> {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: a.title,
        blocks: [
          {
            type: "section",
            text: { type: "mrkdwn", text: `*${a.title}*\n${a.text}` },
          },
          {
            type: "actions",
            elements: [
              {
                type: "button",
                text: { type: "plain_text", text: "Open in TreeVook" },
                url: a.url,
              },
            ],
          },
        ],
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Slack returned ${res.status}`);
  }
}

export class MockNotifier implements EscalationNotifier {
  readonly sent: { webhookUrl: string; escalation: Escalation }[] = [];

  readonly alerts: { webhookUrl: string; alert: Alert }[] = [];

  async send(webhookUrl: string, escalation: Escalation): Promise<void> {
    this.sent.push({ webhookUrl, escalation });
  }

  async alert(webhookUrl: string, alert: Alert): Promise<void> {
    this.alerts.push({ webhookUrl, alert });
  }
}

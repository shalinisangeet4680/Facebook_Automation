export const ESCALATION_NOTIFIER = Symbol("ESCALATION_NOTIFIER");

export interface Escalation {
  appName: string;
  author: string;
  stars: number;
  text: string;
  draft: string | null;
  url: string;
}

export interface EscalationNotifier {
  send(webhookUrl: string, escalation: Escalation): Promise<void>;
}

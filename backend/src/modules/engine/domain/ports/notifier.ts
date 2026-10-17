export const ESCALATION_NOTIFIER = Symbol("ESCALATION_NOTIFIER");

export interface Escalation {
  subjectName: string;
  author: string;
  stars: number;
  text: string;
  draft: string | null;
  url: string;
}

export interface Digest {
  title: string;
  lines: string[];
  url: string;
}

export interface EscalationNotifier {
  send(webhookUrl: string, escalation: Escalation): Promise<void>;
  digest(webhookUrl: string, digest: Digest): Promise<void>;
}

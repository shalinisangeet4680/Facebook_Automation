import { LeadStatus } from "../infrastructure/leads.tables";
import { LeadAnswer } from "./lead-fields";
import { SyncErrorCode } from "./lead-sync";

export interface LeadFilters {
  status?: LeadStatus;
  campaignId?: string;
  q?: string;
}

export interface LeadView {
  id: string;
  leadId: string;
  createdTime: string;
  status: LeadStatus;
  notes: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  answers: LeadAnswer[];
  form: { id: string; name: string | null };
  campaign: { id: string; name: string | null } | null;
  adSet: { id: string; name: string | null } | null;
  ad: { id: string; name: string | null } | null;
}

export interface LeadSyncView {
  status: "never" | "ok" | "error";
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  errorCode: SyncErrorCode | null;
  error: string | null;
  fixes: string[];
  permissionGranted: boolean;
  forms: number;
}

export interface LeadSyncResult {
  status: "ok" | "error";
  forms: number;
  fetched: number;
  created: number;
  alerted: number;
  errorCode: SyncErrorCode | null;
  error: string | null;
}

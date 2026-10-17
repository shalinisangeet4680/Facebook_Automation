import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

import { NotFoundError, ValidationError } from "@shared/errors/domain-error";

import {
  BusinessAddress,
  OpeningPeriod,
  ServiceArea,
} from "../domain/business.types";
import {
  BusinessApiError,
  GbpVerification,
  GbpVerificationOption,
  GbpVoiceOfMerchant,
} from "../domain/ports/business-api";
import {
  BusinessCategory,
  CODE_METHODS,
  GoogleSearchInput,
  METHOD_LABEL,
  NewBusiness,
  VerificationMethod,
  VerificationState,
  checkNewBusiness,
  newBusinessSummary,
} from "../domain/profile.types";
import { GbpLocationRow } from "../infrastructure/business.tables";
import { BusinessActor, BusinessEngine } from "./business-engine.service";
import { BusinessService } from "./business.service";

export const MANAGE_URL = "https://business.google.com/locations";

export interface NewBusinessInput {
  title: string;
  primaryCategory: BusinessCategory | null;
  additionalCategories?: BusinessCategory[];
  phone?: string | null;
  website?: string | null;
  description?: string | null;
  address?: BusinessAddress | null;
  serviceArea?: ServiceArea | null;
  hours?: OpeningPeriod[];
  languageCode?: string;
}

export interface ProfileTarget {
  connectionId?: string | null;
  account?: string | null;
}

export interface CreateProfileInput extends ProfileTarget {
  business: NewBusinessInput;
  requestId?: string;
}

export interface StartVerificationInput {
  method: VerificationMethod;
  email?: string | null;
  contactName?: string | null;
}

const LANGUAGE = "en";

@Injectable()
export class BusinessProfilesService {
  constructor(
    private readonly engine: BusinessEngine,
    private readonly business: BusinessService,
  ) {}

  private get repo() {
    return this.engine.repo;
  }

  private get api() {
    return this.engine.api;
  }

  private async google<T>(
    connectionId: string,
    fn: () => Promise<T>,
  ): Promise<T> {
    try {
      return await fn();
    } catch (err) {
      await this.engine.failConnection(connectionId, err);
      throw err instanceof BusinessApiError
        ? new ValidationError(err.message)
        : err;
    }
  }

  private async active(workspaceId: string) {
    const list = (await this.repo.connections(workspaceId)).filter(
      (c) => c.status === "active",
    );
    if (!list.length)
      throw new ValidationError(
        "Connect the Google account that should own the business first.",
      );
    return list;
  }

  async accounts(workspaceId: string) {
    const data = [];
    for (const c of await this.active(workspaceId)) {
      const accounts = await this.google(c.id, () =>
        this.api.accounts(this.engine.tokenOf(c)),
      );
      for (const a of accounts)
        data.push({
          connectionId: c.id,
          email: c.email,
          account: a.name,
          name: a.accountName,
          type: a.type,
        });
    }
    return { data };
  }

  async createGroup(
    actor: BusinessActor,
    input: { connectionId: string; name: string },
  ) {
    const c = await this.repo.connection(actor.workspaceId, input.connectionId);
    if (!c) throw new NotFoundError("This Google connection doesn't exist.");
    const name = input.name.trim();
    if (!name) throw new ValidationError("Name the business group.");
    const token = this.engine.tokenOf(c);
    const accounts = await this.google(c.id, () => this.api.accounts(token));
    const owner =
      accounts.find(
        (a) => a.type === "PERSONAL" || a.type === "ORGANIZATION",
      ) ?? accounts[0];
    if (!owner)
      throw new ValidationError(
        "This Google account has no Business Profile account to own the group.",
      );
    const group = await this.google(c.id, () =>
      this.api.createLocationGroup(token, name, owner.name),
    );
    await this.engine.record(actor, "group_created", c.id, {
      account: group.name,
      name: group.accountName,
    });
    return {
      connectionId: c.id,
      email: c.email,
      account: group.name,
      name: group.accountName,
      type: group.type,
    };
  }

  async categories(
    workspaceId: string,
    query: string,
    regionCode = "IN",
    languageCode = LANGUAGE,
  ) {
    const [c] = await this.active(workspaceId);
    const data = await this.google(c!.id, () =>
      this.api.categories(
        this.engine.tokenOf(c!),
        query,
        regionCode,
        languageCode,
      ),
    );
    return { data };
  }

  async search(workspaceId: string, input: GoogleSearchInput) {
    const query = input.query.trim();
    if (query.length < 2 && !input.phone?.trim())
      throw new ValidationError("Type the business name to search Google.");
    const [c] = await this.active(workspaceId);
    const matches = await this.google(c!.id, () =>
      this.api.searchGoogle(this.engine.tokenOf(c!), {
        query,
        address: input.address?.trim() || null,
        phone: input.phone?.trim() || null,
        regionCode: input.regionCode,
      }),
    );
    const ours = new Map(
      (await this.repo.locations(workspaceId))
        .filter((l) => l.placeId)
        .map((l) => [l.placeId!, l.id]),
    );
    return {
      data: matches.map((m) => ({
        ...m,
        locationId: (m.placeId && ours.get(m.placeId)) || null,
      })),
    };
  }

  normalize(input: NewBusinessInput): NewBusiness {
    const text = (v?: string | null) => v?.trim() || null;
    const address = input.address
      ? {
          lines: input.address.lines.map((l) => l.trim()).filter(Boolean),
          locality: input.address.locality.trim(),
          region: input.address.region.trim(),
          postalCode: input.address.postalCode.trim(),
          country: input.address.country.trim().toUpperCase(),
        }
      : null;
    const serviceArea = input.serviceArea
      ? {
          regionCode: input.serviceArea.regionCode.trim().toUpperCase(),
          places: input.serviceArea.places.map((p) => p.trim()).filter(Boolean),
        }
      : null;
    return {
      title: input.title.trim(),
      primaryCategory: input.primaryCategory,
      additionalCategories: (input.additionalCategories ?? []).filter(
        (c) => c.name !== input.primaryCategory?.name,
      ),
      phone: text(input.phone),
      website: text(input.website),
      description: input.description?.trim() ?? "",
      address,
      serviceArea:
        serviceArea && (serviceArea.places.length || !address)
          ? serviceArea
          : null,
      hours: input.hours ?? [],
      languageCode: input.languageCode ?? LANGUAGE,
    };
  }

  async target(workspaceId: string, input: ProfileTarget) {
    const connections = await this.active(workspaceId);
    const connection = input.connectionId
      ? connections.find((c) => c.id === input.connectionId)
      : connections.length === 1
        ? connections[0]
        : undefined;
    if (!connection)
      throw new ValidationError(
        "Choose which Google account should own the new profile.",
        { accounts: (await this.accounts(workspaceId)).data },
      );
    const accounts = await this.google(connection.id, () =>
      this.api.accounts(this.engine.tokenOf(connection)),
    );
    const account = input.account
      ? accounts.find((a) => a.name === input.account)
      : accounts.length === 1
        ? accounts[0]
        : undefined;
    if (!account)
      throw new ValidationError(
        "Choose which Business Profile account should own the new profile.",
        {
          accounts: accounts.map((a) => ({
            connectionId: connection.id,
            account: a.name,
            name: a.accountName,
            type: a.type,
          })),
        },
      );
    return { connection, account };
  }

  async validate(workspaceId: string, input: CreateProfileInput) {
    const business = this.normalize(input.business);
    const summary = newBusinessSummary(business);
    const problems = checkNewBusiness(business);
    if (problems.length) return { valid: false, problems, summary };
    const { connection, account } = await this.target(workspaceId, input);
    try {
      await this.api.createLocation(
        this.engine.tokenOf(connection),
        account.name,
        business,
        { validateOnly: true, requestId: randomUUID() },
      );
    } catch (err) {
      if (err instanceof BusinessApiError && err.kind === "invalid")
        return { valid: false, problems: [err.message], summary };
      await this.engine.failConnection(connection.id, err);
      throw err instanceof BusinessApiError
        ? new ValidationError(err.message)
        : err;
    }
    return {
      valid: true,
      problems: [],
      summary: [...summary, `Owner: ${account.accountName}`],
    };
  }

  async create(actor: BusinessActor, input: CreateProfileInput) {
    const business = this.normalize(input.business);
    const problems = checkNewBusiness(business);
    if (problems.length) throw new ValidationError(problems.join(" "));
    const { connection, account } = await this.target(actor.workspaceId, input);
    const requestId = input.requestId ?? randomUUID();
    const created = await this.google(connection.id, () =>
      this.api.createLocation(
        this.engine.tokenOf(connection),
        account.name,
        business,
        { validateOnly: false, requestId },
      ),
    );
    if (!created)
      throw new ValidationError("Google didn't create the profile. Try again.");
    const row = await this.business.importCreated(
      actor.workspaceId,
      connection,
      account.name,
      created,
    );
    await this.engine.record(actor, "location_created", row.id, {
      title: business.title,
      account: account.name,
      location: created.name,
    });
    return this.business.location(actor.workspaceId, row.id);
  }

  private optionView(o: GbpVerificationOption) {
    return {
      method: o.method,
      label: METHOD_LABEL[o.method],
      needsCode: CODE_METHODS.includes(o.method),
      phone: o.phone,
      email: o.email,
      emailEditable: o.emailEditable,
      address: o.address,
      contactName: o.contactName,
      deliveryDays: o.deliveryDays,
    };
  }

  private async options(l: GbpLocationRow) {
    const token = await this.engine.tokenFor(l);
    return this.google(l.connectionId, () =>
      this.api.verificationOptions(token, l.locationName, LANGUAGE, null),
    );
  }

  async verificationOptions(workspaceId: string, id: string) {
    const l = await this.business.locationRow(workspaceId, id);
    if (l.verified) return { data: [], manageUrl: MANAGE_URL };
    return {
      data: (await this.options(l)).map((o) => this.optionView(o)),
      manageUrl: MANAGE_URL,
    };
  }

  async startVerification(
    actor: BusinessActor,
    id: string,
    input: StartVerificationInput,
  ) {
    const l = await this.business.locationRow(actor.workspaceId, id);
    if (l.verified)
      throw new ValidationError("This business is already verified on Google.");
    const option = (await this.options(l)).find(
      (o) => o.method === input.method,
    );
    if (!option)
      throw new ValidationError(
        "Google doesn't offer this way to verify this business. Pick another.",
      );
    let email = option.email;
    if (input.method === "EMAIL" && input.email?.trim()) {
      const wanted = input.email.trim().toLowerCase();
      const domain = option.email?.split("@")[1] ?? "";
      if (!option.emailEditable && wanted !== option.email?.toLowerCase())
        throw new ValidationError(
          `Google only sends the code to ${option.email}.`,
        );
      if (!/^[^\s@]+@[^\s@]+$/.test(wanted) || !wanted.endsWith(`@${domain}`))
        throw new ValidationError(
          `Use an email address at ${domain}, the domain of your website.`,
        );
      email = wanted;
    }
    const contactName =
      input.contactName?.trim() || option.contactName || l.title;
    const token = await this.engine.tokenFor(l);
    const v = await this.google(l.connectionId, () =>
      this.api.verify(token, l.locationName, {
        method: input.method,
        languageCode: LANGUAGE,
        ...(input.method === "SMS" || input.method === "PHONE_CALL"
          ? { phone: option.phone ?? undefined }
          : {}),
        ...(input.method === "EMAIL" && email ? { email } : {}),
        ...(input.method === "ADDRESS" ? { contactName } : {}),
      }),
    );
    const target =
      input.method === "SMS" || input.method === "PHONE_CALL"
        ? option.phone
        : input.method === "EMAIL"
          ? email
          : input.method === "ADDRESS"
            ? option.address
            : null;
    await this.repo.updateLocation(l.id, {
      verificationState: v.state === "COMPLETED" ? "verified" : "pending",
      verificationMethod: v.method,
      verificationName: v.name,
      verificationTarget: target,
      verificationStartedAt: new Date(),
      ...(v.state === "COMPLETED" ? { verified: true } : {}),
    });
    await this.engine.record(actor, "verification_started", l.id, {
      method: v.method,
    });
    if (v.state === "COMPLETED") await this.afterVerified(actor, l.id);
    return this.status(actor.workspaceId, l.id);
  }

  private async afterVerified(actor: BusinessActor, id: string) {
    await this.engine.record(actor, "verified", id, {});
    try {
      await this.business.sync(actor, id);
    } catch {
      return;
    }
  }

  async completeVerification(actor: BusinessActor, id: string, code: string) {
    const l = await this.business.locationRow(actor.workspaceId, id);
    if (l.verified)
      throw new ValidationError("This business is already verified on Google.");
    const pin = code.replace(/[\s-]/g, "");
    if (!/^\d{4,8}$/.test(pin))
      throw new ValidationError("Enter the code from Google, digits only.");
    if (!l.verificationName || l.verificationState !== "pending")
      throw new ValidationError(
        "Ask Google for a code first, then enter it here.",
      );
    const token = await this.engine.tokenFor(l);
    let v: GbpVerification;
    try {
      v = await this.api.completeVerification(token, l.verificationName, pin);
    } catch (err) {
      await this.engine.failConnection(l.connectionId, err);
      if (err instanceof BusinessApiError && err.kind === "invalid") {
        await this.engine.record(actor, "verification_code_rejected", l.id, {
          method: l.verificationMethod,
        });
        throw new ValidationError(
          "That code didn't work. Check it and try again, or ask Google for a new one.",
        );
      }
      throw err instanceof BusinessApiError
        ? new ValidationError(err.message)
        : err;
    }
    if (v.state === "COMPLETED") {
      await this.repo.updateLocation(l.id, {
        verified: true,
        verificationState: "verified",
      });
      await this.afterVerified(actor, l.id);
    } else if (v.state === "FAILED")
      await this.repo.updateLocation(l.id, { verificationState: "failed" });
    return this.status(actor.workspaceId, l.id);
  }

  private stateOf(
    vom: GbpVoiceOfMerchant,
    latest: GbpVerification | null,
  ): VerificationState {
    if (vom.hasVoiceOfMerchant) return "verified";
    if (latest?.state === "PENDING" || vom.pendingVerification)
      return "pending";
    if (latest?.state === "FAILED") return "failed";
    return "unverified";
  }

  async status(workspaceId: string, id: string) {
    let l = await this.business.locationRow(workspaceId, id);
    let vom: GbpVoiceOfMerchant | null = null;
    let error: string | null = null;
    if (!l.verified || l.verificationState !== "verified") {
      try {
        const token = await this.engine.tokenFor(l);
        const [state, list] = await Promise.all([
          this.api.voiceOfMerchant(token, l.locationName),
          this.api.verifications(token, l.locationName),
        ]);
        vom = state;
        const latest = list[0] ?? null;
        const next = this.stateOf(state, latest);
        l = await this.repo.updateLocation(l.id, {
          verified: state.hasVoiceOfMerchant,
          verificationState: next,
          ...(latest && next !== "unverified"
            ? {
                verificationName: latest.name,
                verificationMethod: latest.method,
              }
            : {}),
        });
      } catch (err) {
        if (!(err instanceof BusinessApiError)) throw err;
        error = err.message;
      }
    }
    const method = l.verificationMethod as VerificationMethod | null;
    return {
      locationId: l.id,
      title: l.title,
      verified: l.verified,
      state: l.verificationState,
      method,
      methodLabel: method ? (METHOD_LABEL[method] ?? method) : null,
      target: l.verificationTarget,
      startedAt: l.verificationStartedAt?.toISOString() ?? null,
      needsCode:
        l.verificationState === "pending" &&
        Boolean(method && CODE_METHODS.includes(method)),
      waitingForGoogle: vom?.waitingForGoogle ?? false,
      ownershipConflict: vom?.ownershipConflict ?? false,
      guidelinesIssue: vom?.guidelinesIssue ?? null,
      note: this.note(l, vom),
      error,
      manageUrl: MANAGE_URL,
    };
  }

  private note(l: GbpLocationRow, vom: GbpVoiceOfMerchant | null) {
    if (l.verificationState === "verified")
      return "Verified. Reviews, posts and insights work for this business.";
    if (vom?.ownershipConflict)
      return "Someone else already manages this business on Google. Request access from Business Profile.";
    if (vom?.guidelinesIssue)
      return "Google wants changes before it verifies this business. Open Business Profile to see what to fix.";
    if (vom?.waitingForGoogle)
      return "Google is reviewing this business. This can take a few days; there's nothing to do meanwhile.";
    if (l.verificationState === "pending") {
      const to = l.verificationTarget ? ` to ${l.verificationTarget}` : "";
      switch (l.verificationMethod) {
        case "SMS":
          return `Google texted a code${to}. Enter it below.`;
        case "PHONE_CALL":
          return `Google is calling${to} with a code. Enter it below.`;
        case "EMAIL":
          return `Google emailed a code${to}. Enter it below.`;
        case "ADDRESS":
          return `Google is mailing a postcard with a code${to}. It usually arrives within 14 days.`;
        default:
          return "Google is checking this business. Finish any steps it asks for in Business Profile.";
      }
    }
    if (l.verificationState === "failed")
      return "The last verification didn't finish. Choose a way to verify again.";
    return "Not verified yet. Google hides new profiles, replies and posts until you verify.";
  }
}

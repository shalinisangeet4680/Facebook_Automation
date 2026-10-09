import { Injectable } from "@nestjs/common";

import { PERMISSIONS } from "../domain/meta.requirements";
import { metaTokenInvalid } from "../domain/meta.errors";
import {
  GraphAdAccount,
  GraphBusiness,
  GraphDataset,
  GraphIdentity,
  GraphPage,
  MetaGraph,
} from "../domain/ports/meta-graph";

@Injectable()
export class MockMetaGraph implements MetaGraph {
  identity(token: string): Promise<GraphIdentity> {
    if (token.includes("invalid")) return Promise.reject(metaTokenInvalid());
    return Promise.resolve({ id: "61550000000001", name: "Ads Autopilot" });
  }

  grantedPermissions(token: string): Promise<string[]> {
    const all = PERMISSIONS.map((p) => p.name);
    if (token.includes("noperms")) {
      return Promise.resolve(all.filter((p) => p !== "ads_management"));
    }
    if (token.includes("basicperms")) {
      return Promise.resolve(
        PERMISSIONS.filter((p) => p.level === "required").map((p) => p.name),
      );
    }
    return Promise.resolve(all);
  }

  businesses(): Promise<GraphBusiness[]> {
    return Promise.resolve([
      {
        id: "1101000000000001",
        name: "Arogya System",
        verificationStatus: "verified",
      },
    ]);
  }

  adAccounts(token: string): Promise<GraphAdAccount[]> {
    if (token.includes("noads")) return Promise.resolve([]);
    return Promise.resolve([
      {
        id: "act_1201000000000001",
        accountId: "1201000000000001",
        name: "Arogya System Ads",
        currency: "INR",
        timezone: "Asia/Kolkata",
        status: 1,
        amountSpent: "0",
        spendCap: "3000000",
        businessId: "1101000000000001",
        businessName: "Arogya System",
      },
    ]);
  }

  pages(token: string): Promise<GraphPage[]> {
    if (token.includes("nopages")) return Promise.resolve([]);
    return Promise.resolve([
      {
        id: "1301000000000001",
        name: "Arogya System",
        category: "Software",
        pictureUrl: null,
        instagram: {
          id: "1781000000000001",
          username: "arogyasystem",
          pictureUrl: null,
        },
      },
    ]);
  }

  datasets(_token: string, adAccountId: string): Promise<GraphDataset[]> {
    return Promise.resolve([
      {
        id: "2519233968487265",
        name: "Arogya System Website",
        adAccountId,
        lastFiredTime: new Date().toISOString(),
        isUnavailable: false,
      },
    ]);
  }
}

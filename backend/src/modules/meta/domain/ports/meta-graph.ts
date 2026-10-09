export const META_GRAPH = Symbol("META_GRAPH");

export interface GraphIdentity {
  id: string;
  name: string;
}

export interface GraphBusiness {
  id: string;
  name: string;
  verificationStatus: string | null;
}

export interface GraphAdAccount {
  id: string;
  accountId: string;
  name: string;
  currency: string;
  timezone: string | null;
  status: number;
  amountSpent: string | null;
  spendCap: string | null;
  businessId: string | null;
  businessName: string | null;
}

export interface GraphPage {
  id: string;
  name: string;
  category: string | null;
  pictureUrl: string | null;
  instagram: {
    id: string;
    username: string;
    pictureUrl: string | null;
  } | null;
}

export interface GraphDataset {
  id: string;
  name: string;
  adAccountId: string;
  lastFiredTime: string | null;
  isUnavailable: boolean;
}

export interface MetaGraph {
  identity(token: string): Promise<GraphIdentity>;
  grantedPermissions(token: string): Promise<string[]>;
  businesses(token: string): Promise<GraphBusiness[]>;
  adAccounts(token: string): Promise<GraphAdAccount[]>;
  pages(token: string): Promise<GraphPage[]>;
  datasets(token: string, adAccountId: string): Promise<GraphDataset[]>;
}

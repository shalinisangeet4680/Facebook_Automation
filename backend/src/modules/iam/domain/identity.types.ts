import { WorkspaceRole } from "../infrastructure/iam.tables";

export interface UserProfile {
  id: string;
  phone: string;
  name: string | null;
}

export interface WorkspaceSummary {
  id: string;
  name: string;
  role: WorkspaceRole;
}

export interface MeView {
  user: UserProfile;
  workspace: WorkspaceSummary;
}

export interface SignInIdentity {
  user: UserProfile;
  workspace: WorkspaceSummary;
  isNewUser: boolean;
}

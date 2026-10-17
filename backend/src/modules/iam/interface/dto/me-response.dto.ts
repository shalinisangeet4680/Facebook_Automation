export class UserProfileDto {
  id: string;
  phone: string | null;
  name: string | null;
  email: string | null;
  avatarUrl: string | null;
}

export class WorkspaceSummaryDto {
  id: string;
  name: string;
  role: "owner" | "admin" | "member";
}

export class MeResponseDto {
  user: UserProfileDto;
  workspace: WorkspaceSummaryDto;
}

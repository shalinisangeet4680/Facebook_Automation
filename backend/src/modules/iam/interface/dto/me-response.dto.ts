export class UserProfileDto {
  id: string;
  phone: string;
  name: string | null;
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

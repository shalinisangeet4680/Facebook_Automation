export class CreativeDto {
  id: string;
  name: string;
  source: "upload" | "claude";
  url: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  kind: "image" | "video";
  durationSeconds: number | null;
  createdAt: string;
}

export class CreativeListDto {
  data: CreativeDto[];
}

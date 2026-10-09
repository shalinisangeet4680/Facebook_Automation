export class CreativeDto {
  id: string;
  name: string;
  source: "upload" | "claude";
  url: string;
  mime: string;
  width: number;
  height: number;
  bytes: number;
  createdAt: string;
}

export class CreativeListDto {
  data: CreativeDto[];
}

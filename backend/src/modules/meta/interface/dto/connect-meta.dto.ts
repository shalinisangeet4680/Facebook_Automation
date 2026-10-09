import { IsString, Length } from "class-validator";

export class ConnectMetaDto {
  @IsString()
  @Length(30, 1000, { message: "Paste the full token generated in Meta." })
  token: string;
}

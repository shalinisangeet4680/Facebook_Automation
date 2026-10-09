import { IsString, Length } from "class-validator";

export class RequestOtpDto {
  @IsString()
  @Length(10, 16)
  phone: string;
}

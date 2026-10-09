import { IsString, Length, Matches } from "class-validator";

export class VerifyOtpDto {
  @IsString()
  @Length(10, 16)
  phone: string;

  @IsString()
  @Matches(/^\d{6}$/, { message: "Enter the 6-digit code." })
  code: string;
}

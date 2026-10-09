import { Injectable, Logger } from "@nestjs/common";

import { OtpSender } from "../domain/ports/otp-sender";
import { displayPhone } from "../domain/phone";

@Injectable()
export class LogOtpSender implements OtpSender {
  private readonly logger = new Logger(LogOtpSender.name);

  send(phone: string): Promise<void> {
    this.logger.log(`OTP issued for ${displayPhone(phone).slice(0, 8)}*****`);
    return Promise.resolve();
  }
}

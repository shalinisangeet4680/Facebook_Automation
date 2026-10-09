import { ValidationError } from "@shared/errors/domain-error";

export function normalizeIndianPhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  const local =
    digits.length === 12 && digits.startsWith("91")
      ? digits.slice(2)
      : digits.length === 11 && digits.startsWith("0")
        ? digits.slice(1)
        : digits;
  if (!/^[6-9]\d{9}$/.test(local)) {
    throw new ValidationError("Enter a valid 10-digit Indian mobile number.");
  }
  return `+91${local}`;
}

export function localDigits(e164: string): string {
  return e164.slice(-10);
}

export function displayPhone(e164: string): string {
  const local = localDigits(e164);
  return `+91 ${local.slice(0, 5)} ${local.slice(5)}`;
}

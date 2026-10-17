export const OWNER = "9000000031";
export const OTHER = "9000000032";

process.env.OTP_TEST_NUMBERS = `${process.env.OTP_TEST_NUMBERS},${OWNER}:123456,${OTHER}:123456`;

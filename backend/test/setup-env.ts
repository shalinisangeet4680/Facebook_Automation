import { tmpdir } from "os";
import { join } from "path";

import { testDatabaseUrl } from "./test-database";

const databaseUrl = testDatabaseUrl();
if (databaseUrl) process.env.DATABASE_URL = databaseUrl;
if (!process.env.CI) process.env.REDIS_URL = "redis://localhost:6379/1";
process.env.OTP_TEST_NUMBERS =
  "8434230999:963101,9000000001:123456,9000000002:123456,9000000003:123456,9000000004:123456,9000000005:123456,9000000006:123456,9000000010:123456,9000000011:123456,9000000012:123456,9000000013:123456,9000000014:123456";
process.env.LOG_LEVEL = "error";
process.env.META_MOCK = "true";
process.env.APP_URL = "http://localhost:3200";
process.env.MEDIA_DIR = join(tmpdir(), "adpilot-test-media");

import { Test } from "@nestjs/testing";
import { eq } from "drizzle-orm";

import { IdentityService } from "@modules/iam/application/identity.service";
import { IamModule } from "@modules/iam/iam.module";
import { users, workspaces } from "@modules/iam/infrastructure/iam.tables";
import { ConfigModule } from "@shared/config/config.module";
import { DATABASE, Database } from "@shared/database/database";
import { DatabaseModule } from "@shared/database/database.module";

describe("IdentityService", () => {
  const phone = `+9199${Date.now().toString().slice(-8)}`;
  let identity: IdentityService;
  let db: Database;
  let close: () => Promise<void>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ConfigModule, DatabaseModule, IamModule],
    }).compile();
    await moduleRef.init();
    identity = moduleRef.get(IdentityService);
    db = moduleRef.get(DATABASE);
    close = () => moduleRef.close();
  });

  afterAll(async () => {
    const user = await db.query.users.findFirst({
      where: eq(users.phone, phone),
    });
    if (user) {
      await db.delete(workspaces).where(eq(workspaces.ownerId, user.id));
      await db.delete(users).where(eq(users.id, user.id));
    }
    await close();
  });

  it("creates a user and an owned workspace on first sign-in", async () => {
    const first = await identity.signIn(phone);
    expect(first.isNewUser).toBe(true);
    expect(first.user.phone).toBe(phone);
    expect(first.workspace.role).toBe("owner");
  });

  it("reuses the same user and workspace on later sign-ins", async () => {
    const first = await identity.signIn(phone);
    const second = await identity.signIn(phone);
    expect(second.isNewUser).toBe(false);
    expect(second.user.id).toBe(first.user.id);
    expect(second.workspace.id).toBe(first.workspace.id);
  });

  it("returns the profile for a valid tenant context", async () => {
    const signedIn = await identity.signIn(phone);
    const me = await identity.me({
      userId: signedIn.user.id,
      workspaceId: signedIn.workspace.id,
      sessionId: "s",
    });
    expect(me.workspace.id).toBe(signedIn.workspace.id);
    expect(me.user.id).toBe(signedIn.user.id);
  });

  it("refuses a workspace the user does not belong to", async () => {
    const signedIn = await identity.signIn(phone);
    await expect(
      identity.me({
        userId: signedIn.user.id,
        workspaceId: "00000000-0000-7000-8000-000000000000",
        sessionId: "s",
      }),
    ).rejects.toThrow("Your account could not be found.");
  });
});

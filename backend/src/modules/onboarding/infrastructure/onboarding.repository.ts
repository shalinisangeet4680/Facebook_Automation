import { Inject, Injectable } from "@nestjs/common";
import { and, eq, inArray } from "drizzle-orm";

import { DATABASE, Database } from "@shared/database/database";

import { OnboardingStepId } from "../domain/onboarding.steps";
import { OnboardingProgressRow, onboardingProgress } from "./onboarding.tables";

@Injectable()
export class OnboardingRepository {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  list(workspaceId: string): Promise<OnboardingProgressRow[]> {
    return this.db
      .select()
      .from(onboardingProgress)
      .where(eq(onboardingProgress.workspaceId, workspaceId));
  }

  async complete(workspaceId: string, step: OnboardingStepId): Promise<void> {
    const now = new Date();
    await this.db
      .insert(onboardingProgress)
      .values({ workspaceId, step, status: "completed", completedAt: now })
      .onConflictDoUpdate({
        target: [onboardingProgress.workspaceId, onboardingProgress.step],
        set: { status: "completed", completedAt: now },
      });
  }

  async skip(workspaceId: string, step: OnboardingStepId): Promise<void> {
    const now = new Date();
    await this.db
      .insert(onboardingProgress)
      .values({ workspaceId, step, status: "skipped", completedAt: now })
      .onConflictDoUpdate({
        target: [onboardingProgress.workspaceId, onboardingProgress.step],
        set: { status: "skipped", completedAt: now },
      });
  }

  async reset(workspaceId: string, steps: OnboardingStepId[]): Promise<void> {
    await this.db
      .delete(onboardingProgress)
      .where(
        and(
          eq(onboardingProgress.workspaceId, workspaceId),
          inArray(onboardingProgress.step, steps),
        ),
      );
  }
}

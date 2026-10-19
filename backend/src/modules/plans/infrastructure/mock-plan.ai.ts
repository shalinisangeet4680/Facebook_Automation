import { draftPlanCopy } from "../domain/plan-generation";
import { PlanAi, PlanAiInput, PlanAiResult } from "../domain/ports/plan-ai";

export class MockPlanAi implements PlanAi {
  readonly calls: PlanAiInput[] = [];

  async write(_apiKey: string, input: PlanAiInput): Promise<PlanAiResult> {
    this.calls.push(input);
    return draftPlanCopy(input);
  }
}

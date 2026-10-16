import { keywordTopic } from "./topics";

describe("keywordTopic", () => {
  it("tags common complaints and praise", () => {
    expect(keywordTopic("Workouts stopped syncing with my watch", 2)).toBe(
      "Sync",
    );
    expect(keywordTopic("La app se cierra", 1)).toBe("Other");
    expect(keywordTopic("The app keeps crashing", 1)).toBe("Crash");
    expect(keywordTopic("I really need shared budgets, please add it", 3)).toBe(
      "Feature request",
    );
    expect(keywordTopic("Doesn't feel like homework", 5)).toBe("Praise");
    expect(keywordTopic("Charged twice, want a refund", 1)).toBe("Payment");
  });
});

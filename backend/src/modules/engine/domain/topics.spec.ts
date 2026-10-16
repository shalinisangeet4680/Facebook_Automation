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

  it("uses business topics for Google Business reviews", () => {
    const biz = (text: string, stars: number) =>
      keywordTopic(text, stars, "google_business");
    expect(biz("Waited 2 hours for my appointment", 2)).toBe("Wait time");
    expect(biz("Receptionist was rude", 1)).toBe("Staff");
    expect(biz("Too expensive for what you get", 2)).toBe("Price");
    expect(biz("Lovely place", 5)).toBe("Praise");
    expect(biz("App keeps crashing", 1)).toBe("Other");
  });
});

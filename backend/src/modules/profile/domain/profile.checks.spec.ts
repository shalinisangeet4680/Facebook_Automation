import { facebookChecks, instagramChecks, score } from "./profile.checks";

const facebook = {
  id: "1",
  name: "Arogya System",
  username: null,
  link: null,
  about: "Clinic software",
  description: null,
  website: null,
  phone: null,
  email: "hi@example.com",
  category: null,
  pictureUrl: null,
  pictureIsDefault: true,
  coverUrl: "https://x/cover.jpg",
  followers: 0,
};

describe("profile checks", () => {
  it("scores a half-finished Page", () => {
    const checks = facebookChecks(facebook);
    expect(Object.fromEntries(checks.map((c) => [c.key, c.status]))).toEqual({
      picture: "missing",
      cover: "done",
      about: "weak",
      website: "missing",
      contact: "done",
    });
    expect(score(checks)).toBe(50);
  });

  it("checks Instagram bio length and link", () => {
    const checks = instagramChecks({
      id: "1",
      username: "a",
      name: "Arogya",
      biography:
        "One app for appointments, prescriptions, billing and WhatsApp reminders. Free demo 👇",
      website: "https://arogyasystem.com",
      pictureUrl: "https://x/p.jpg",
      followers: 1,
      posts: 1,
    });
    expect(score(checks)).toBe(100);
  });
});

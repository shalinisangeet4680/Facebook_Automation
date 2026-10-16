import { suggestFromListing, suggestFromReplies } from "./variable-suggestions";

describe("variable suggestions", () => {
  it("reads contact details and sign-offs from past replies", () => {
    const s = suggestFromReplies([
      "Hi Priya, sorry about that. Please write to Help@VidyaHQ.app or call +91 98765 43210. — Team VidyaHQ",
      "Thanks Rahul! Details at https://vidyahq.app/help. — Team VidyaHQ",
      "Glad you like it. Regards, Team VidyaHQ",
      "Write to help@vidyahq.app and we'll sort it. — Sam",
    ]);
    expect(
      Object.fromEntries(s.map((x) => [x.key, [x.value, x.count]])),
    ).toEqual({
      support_email: ["help@vidyahq.app", 2],
      support_url: ["https://vidyahq.app/help", 1],
      support_phone: ["+91 98765 43210", 1],
      developer_name: ["Team VidyaHQ", 3],
    });
  });

  it("ignores Play links, placeholders and one-off sign-offs", () => {
    const s = suggestFromReplies([
      "See https://play.google.com/store/apps/details?id=x — {developer_name}",
      "Thanks! — Anna",
      "Thanks! — Bob",
      "Thank you for your encouraging words",
      "Thank you for your encouraging words",
    ]);
    expect(s).toEqual([]);
    expect(suggestFromReplies([])).toEqual([]);
  });

  it("uses the store listing contacts", () => {
    expect(
      suggestFromListing({
        email: "help@x.app",
        phone: null,
        website: "https://x.app",
      }),
    ).toEqual([
      {
        key: "support_email",
        value: "help@x.app",
        source: "play_listing",
        count: 1,
      },
      {
        key: "support_url",
        value: "https://x.app",
        source: "play_listing",
        count: 1,
      },
    ]);
  });
});

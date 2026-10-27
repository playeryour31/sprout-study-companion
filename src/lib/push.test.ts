import { describe, expect, it } from "vitest";
import { pushText } from "./push.server";

const exam = {
  title: "",
  body: "Bring a calculator",
  event: { type: "exam", title: "Algebra final", starts_at: "2026-11-05T08:00:00Z", location: "Hall 2" },
};

describe("push notification text", () => {
  it("announces a scheduled exam in Arabic in the student's time zone", () => {
    const t = pushText(exam, "ar", "Africa/Cairo");
    expect(t.title).toBe("جديد — امتحان: Algebra final");
    expect(t.body).toContain("10:00"); // 08:00 UTC is 10:00 in Cairo in November
    expect(t.body).toContain("Hall 2");
    expect(t.body).toContain("Bring a calculator");
    expect(t.url).toBe("/schedule");
  });

  it("uses English for students who chose English", () => {
    expect(pushText(exam, "en", "Africa/Cairo").title).toBe("New exam: Algebra final");
  });

  it("sends plain announcements as written and opens the alerts page", () => {
    expect(pushText({ title: "No school Monday", body: "Holiday", event: null }, "ar", "Africa/Cairo")).toEqual({
      title: "No school Monday",
      body: "Holiday",
      url: "/notifications",
    });
  });
});

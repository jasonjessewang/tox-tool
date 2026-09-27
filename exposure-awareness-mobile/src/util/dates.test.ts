import { daysAgoISO, daysBetweenISO, localISODate, todayISO } from "./dates";

// These run under whatever TZ the process has; the assertions are built from local components so
// they hold in every zone (run the suite with TZ=America/Chicago, TZ=Asia/Seoul, TZ=Pacific/Kiritimati to see).

test("a local evening and a local morning are the calendar day the person is actually in", () => {
  const evening = new Date(2026, 8, 25, 21, 30); // 9:30 pm local -- already tomorrow in UTC for anyone west of it
  const morning = new Date(2026, 8, 26, 6, 45); // 6:45 am local -- still yesterday in UTC for anyone east of it
  expect(localISODate(evening)).toBe("2026-09-25");
  expect(localISODate(morning)).toBe("2026-09-26");
  expect(todayISO(evening)).toBe("2026-09-25");
});

test("month and year boundaries roll over on the local calendar", () => {
  expect(localISODate(new Date(2026, 0, 1, 0, 5))).toBe("2026-01-01");
  expect(localISODate(new Date(2025, 11, 31, 23, 55))).toBe("2025-12-31");
  expect(daysAgoISO(1, new Date(2026, 2, 1, 8))).toBe("2026-02-28");
  expect(daysAgoISO(1, new Date(2028, 2, 1, 8))).toBe("2028-02-29"); // leap year
});

test("daysAgoISO is calendar arithmetic and does not depend on the time of day", () => {
  for (const hour of [0, 1, 11, 12, 13, 23]) {
    const now = new Date(2026, 8, 25, hour, 30);
    expect(daysAgoISO(0, now)).toBe("2026-09-25");
    expect(daysAgoISO(6, now)).toBe("2026-09-19");
    expect(daysAgoISO(13, now)).toBe("2026-09-12");
    expect(daysAgoISO(-1, now)).toBe("2026-09-26"); // tomorrow, used for inclusive range ends
  }
});

test("daysAgoISO steps by whole calendar days across a daylight-saving change", () => {
  // 2026-03-08 (US) and 2026-03-29 (EU) are the spring-forward days; a 23-hour day must still count as one day.
  for (const [y, m, d] of [[2026, 2, 8], [2026, 2, 9], [2026, 2, 29], [2026, 2, 30], [2026, 9, 25], [2026, 10, 1]]) {
    const now = new Date(y, m, d, 12);
    const seen = Array.from({ length: 10 }, (_, i) => daysAgoISO(i, now));
    expect(new Set(seen).size).toBe(10);
    for (let i = 1; i < seen.length; i++) expect(daysBetweenISO(seen[i], seen[i - 1])).toBe(1);
  }
});

test("daysBetweenISO counts calendar days between day keys", () => {
  expect(daysBetweenISO("2026-09-25", "2026-09-25")).toBe(0);
  expect(daysBetweenISO("2026-09-24", "2026-09-25")).toBe(1);
  expect(daysBetweenISO("2026-08-31", "2026-09-01")).toBe(1);
  expect(daysBetweenISO("2026-03-01", "2026-06-01")).toBe(92);
  expect(daysBetweenISO("2026-09-26", "2026-09-25")).toBe(-1);
});

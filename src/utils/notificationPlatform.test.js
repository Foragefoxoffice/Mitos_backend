const { normalizeTargetPlatform, detectFcmPlatform, filterUsersByPlatform } = require("./notificationPlatform");

describe("normalizeTargetPlatform", () => {
  test("defaults to ALL when missing", () => {
    expect(normalizeTargetPlatform(undefined)).toBe("ALL");
    expect(normalizeTargetPlatform("")).toBe("ALL");
  });
  test("accepts any case", () => {
    expect(normalizeTargetPlatform("android")).toBe("ANDROID");
    expect(normalizeTargetPlatform("IOS")).toBe("IOS");
  });
  test("rejects unknown values", () => {
    expect(normalizeTargetPlatform("web")).toBeNull();
  });
});

describe("detectFcmPlatform", () => {
  test("prefers explicit body platform", () => {
    expect(detectFcmPlatform("ios", "okhttp/4.9.2")).toBe("ios");
    expect(detectFcmPlatform("Android", undefined)).toBe("android");
  });
  test("falls back to User-Agent", () => {
    expect(detectFcmPlatform(undefined, "okhttp/4.9.2")).toBe("android");
    expect(detectFcmPlatform(undefined, "MitosLearning/12 CFNetwork/1494.0.7 Darwin/23.4.0")).toBe("ios");
  });
  test("returns null when unknown", () => {
    expect(detectFcmPlatform("web", "Mozilla/5.0")).toBeNull();
    expect(detectFcmPlatform(undefined, undefined)).toBeNull();
  });
});

describe("filterUsersByPlatform", () => {
  const users = [
    { id: 1, fcmPlatform: "android" },
    { id: 2, fcmPlatform: "ios" },
    { id: 3, fcmPlatform: null },
  ];
  test("ALL keeps everyone", () => {
    expect(filterUsersByPlatform(users, "ALL")).toEqual({ users, skippedOtherPlatform: 0, unknownPlatform: 0 });
  });
  test("ANDROID keeps only android and counts unknowns", () => {
    const r = filterUsersByPlatform(users, "ANDROID");
    expect(r.users.map((u) => u.id)).toEqual([1]);
    expect(r.skippedOtherPlatform).toBe(2);
    expect(r.unknownPlatform).toBe(1);
  });
  test("IOS keeps only ios", () => {
    expect(filterUsersByPlatform(users, "IOS").users.map((u) => u.id)).toEqual([2]);
  });
});

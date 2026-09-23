const {
  normalizeCheckoutPhone,
  normalizeCheckoutEmail,
  isValidEmail,
  maskPhone,
} = require("./checkoutPhone");

describe("normalizeCheckoutPhone", () => {
  it.each([
    ["9876543210", "+919876543210"],
    ["+91 98765-43210", "+919876543210"],
    ["919876543210", "+919876543210"],
    ["09876543210", "+919876543210"],
  ])("normalizes %s -> %s", (input, expected) => {
    expect(normalizeCheckoutPhone(input)).toBe(expected);
  });

  it.each([
    ["5876543210"],
    ["98765"],
    [""],
    [null],
  ])("rejects %s", (input) => {
    expect(normalizeCheckoutPhone(input)).toBeNull();
  });
});

describe("maskPhone", () => {
  it("masks a normalized phone", () => {
    expect(maskPhone("+919876543210")).toBe("98xxxxxx10");
  });
});

describe("normalizeCheckoutEmail / isValidEmail", () => {
  it("trims and lowercases a valid email", () => {
    expect(normalizeCheckoutEmail("  Foo@Example.COM  ")).toBe("foo@example.com");
  });

  it("returns null for invalid email", () => {
    expect(normalizeCheckoutEmail("not-an-email")).toBeNull();
    expect(normalizeCheckoutEmail("")).toBeNull();
    expect(normalizeCheckoutEmail(null)).toBeNull();
  });

  it("isValidEmail matches normalize behavior", () => {
    expect(isValidEmail("a@b.com")).toBe(true);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail(null)).toBe(false);
  });
});

const { completedTopics, accuracyPercent } = require("./topicCompletion");

describe("completedTopics", () => {
  const m = (o) => new Map(Object.entries(o).map(([k, v]) => [Number(k), v]));

  it("completes a topic whose every question was covered", () => {
    expect(completedTopics(m({ 1: 48 }), m({ 1: 48 }))).toEqual([1]);
  });
  it("allows the 90% slack for questions added mid-session", () => {
    expect(completedTopics(m({ 1: 45 }), m({ 1: 50 }))).toEqual([1]);
    expect(completedTopics(m({ 1: 44 }), m({ 1: 50 }))).toEqual([]);
  });
  it("does not complete a short (e.g. 10-question) session", () => {
    expect(completedTopics(m({ 1: 10 }), m({ 1: 48 }))).toEqual([]);
  });
  it("judges each topic of a multi-topic session separately", () => {
    expect(completedTopics(m({ 1: 20, 2: 3 }), m({ 1: 20, 2: 30 }))).toEqual([1]);
  });
  it("never completes an empty topic or one not covered at all", () => {
    expect(completedTopics(m({}), m({ 1: 0, 2: 5 }))).toEqual([]);
  });
});

describe("accuracyPercent", () => {
  it("computes a 0-100 percentage", () => {
    expect(accuracyPercent(3, 4)).toBe(75);
    expect(accuracyPercent(1, 3)).toBe(33.3);
  });
  it("is 0 when nothing answered or input is junk", () => {
    expect(accuracyPercent(0, 0)).toBe(0);
    expect(accuracyPercent("x", 5)).toBe(0);
    expect(accuracyPercent(-1, 5)).toBe(0);
  });
  it("caps correct at answered", () => {
    expect(accuracyPercent(9, 5)).toBe(100);
  });
});

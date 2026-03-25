import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  skeletonBlock,
  skeletonComponents,
  stopProgressStages,
  PROGRESS_STAGES,
} from "../src/skeleton/skeleton.js";

describe("skeletonBlock", () => {
  it("generates Card + Column + N text lines", () => {
    const result = skeletonBlock("b", 3);
    // Card + Column + 3 Text = 5 components
    assert.equal(result.length, 5);
    assert.equal(result[0].component, "Card");
    assert.equal(result[1].component, "Column");
    assert.equal(result[1].children.length, 3);
    for (let i = 2; i < 5; i++) {
      assert.equal(result[i].component, "Text");
      assert.equal(result[i].style, "skeleton-line");
    }
  });

  it("respects custom line count", () => {
    const result = skeletonBlock("x", 1);
    assert.equal(result.length, 3); // Card + Column + 1 Text
  });
});

describe("skeletonComponents", () => {
  it("returns table skeleton for data_table", () => {
    const comps = skeletonComponents({ template: "data_table" });
    assert.equal(comps[0].id, "root");
    assert.equal(comps[0].component, "Column");
    // header + 4 rows
    assert.ok(comps.some((c: any) => c.id === "sk-hdr"));
    assert.ok(comps.some((c: any) => c.id === "sk-r3"));
  });

  it("returns grid skeleton for dashboard", () => {
    const comps = skeletonComponents({ template: "dashboard" });
    assert.ok(comps.some((c: any) => c.component === "Row"));
    // 3 card blocks
    assert.ok(comps.some((c: any) => c.id === "sk-c0"));
    assert.ok(comps.some((c: any) => c.id === "sk-c2"));
  });

  it("returns grid skeleton for multi_card", () => {
    const comps = skeletonComponents({ template: "multi_card" });
    assert.ok(comps.some((c: any) => c.id === "sk-c1"));
  });

  it("returns form skeleton for detail", () => {
    const comps = skeletonComponents({ template: "detail" });
    assert.ok(comps.some((c: any) => c.id === "sk-b0"));
    assert.ok(comps.some((c: any) => c.id === "sk-b1"));
  });

  it("returns generic skeleton for unknown template", () => {
    const comps = skeletonComponents({});
    assert.equal(comps[0].id, "root");
    assert.ok(comps.some((c: any) => c.id === "sk-b0"));
    assert.ok(!comps.some((c: any) => c.id === "sk-b1"));
  });
});

describe("PROGRESS_STAGES", () => {
  it("has increasing delays", () => {
    for (let i = 1; i < PROGRESS_STAGES.length; i++) {
      assert.ok(PROGRESS_STAGES[i].delay > PROGRESS_STAGES[i - 1].delay);
    }
  });

  it("all have text and status", () => {
    for (const s of PROGRESS_STAGES) {
      assert.ok(s.text.length > 0);
      assert.equal(s.status, "working");
    }
  });
});

describe("stopProgressStages", () => {
  it("does not throw when no timer is active", () => {
    assert.doesNotThrow(() => stopProgressStages());
  });
});

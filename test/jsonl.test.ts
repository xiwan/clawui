import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { generateJsonl } from "../src/utils/jsonl.js";

describe("jsonl", () => {
  it("generates surfaceUpdate + beginRendering (v0.8)", () => {
    const result = generateJsonl("main", [{ id: "t", component: "Text", text: "hi" }]);
    const lines = result.split("\n");
    assert.equal(lines.length, 2);

    const update = JSON.parse(lines[0]);
    assert.equal(update.surfaceUpdate.surfaceId, "main");
    assert.deepEqual(Object.keys(update.surfaceUpdate.components[0].component), ["Text"]);

    const begin = JSON.parse(lines[1]);
    assert.equal(begin.beginRendering.surfaceId, "main");
    assert.equal(begin.beginRendering.root, "t");
  });

  it("includes dataModelUpdate lines for each data key", () => {
    const result = generateJsonl("s1", [{ id: "r", component: "Column" }], { name: "Alice", age: 30 });
    const lines = result.split("\n");
    assert.equal(lines.length, 4); // surfaceUpdate + 2 data + beginRendering

    const dm1 = JSON.parse(lines[1]);
    assert.equal(dm1.dataModelUpdate.path, "/name");
    assert.equal(dm1.dataModelUpdate.value, "Alice");
    assert.equal(dm1.dataModelUpdate.op, "replace");
  });

  it("converts component types to v0.8 nested format", () => {
    const result = generateJsonl("main", [
      { id: "root", component: "Column", children: ["t1", "b1"] },
      { id: "t1", component: "Text", text: "hello", variant: "h1" },
      { id: "b1", component: "Button", child: "bl", action: { event: { name: "submit" } } },
    ]);
    const update = JSON.parse(result.split("\n")[0]);
    const comps = update.surfaceUpdate.components;

    // Column
    assert.deepEqual(comps[0].component.Column.children, { explicitList: ["t1", "b1"] });
    // Text
    assert.deepEqual(comps[1].component.Text.text, { literalString: "hello" });
    assert.equal(comps[1].component.Text.usageHint, "h1");
    // Button
    assert.deepEqual(comps[2].component.Button.action, { name: "submit" });
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bindData } from "../src/utils/data-binding.js";

describe("data-binding", () => {
  it("replaces {{var}} in strings", () => {
    assert.equal(bindData("Hello {{name}}", { name: "World" }), "Hello World");
  });

  it("replaces nested path {{a.b}}", () => {
    assert.equal(bindData("{{user.name}}", { user: { name: "Alice" } }), "Alice");
  });

  it("replaces missing var with empty string", () => {
    assert.equal(bindData("Hi {{missing}}", {}), "Hi ");
  });

  it("recursively processes objects", () => {
    const result = bindData({ text: "{{title}}", label: "{{name}}" }, { title: "T", name: "N" });
    assert.deepEqual(result, { text: "T", label: "N" });
  });

  it("recursively processes arrays", () => {
    const result = bindData(["{{a}}", "{{b}}"], { a: "1", b: "2" });
    assert.deepEqual(result, ["1", "2"]);
  });

  it("leaves non-string primitives unchanged", () => {
    assert.equal(bindData(42, {}), 42);
    assert.equal(bindData(true, {}), true);
    assert.equal(bindData(null, {}), null);
  });
});

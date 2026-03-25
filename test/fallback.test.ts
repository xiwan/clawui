import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { toMarkdown } from "../src/fallback/markdown.js";

describe("fallback markdown", () => {
  it("converts Text h1", () => {
    assert.equal(toMarkdown([{ id: "t", component: "Text", text: "Title", variant: "h1" }]), "# Title");
  });

  it("converts Text body", () => {
    assert.equal(toMarkdown([{ id: "t", component: "Text", text: "hello" }]), "hello");
  });

  it("converts Button", () => {
    assert.equal(toMarkdown([{ id: "b", component: "Button", child: "Click" }]), "[Click]");
  });

  it("converts TextField", () => {
    assert.equal(toMarkdown([{ id: "f", component: "TextField", label: "Name" }]), "📝 Name: ___");
  });

  it("converts Card", () => {
    assert.equal(toMarkdown([{ id: "c", component: "Card", title: "Info" }]), "> 📋 Info");
  });

  it("converts Divider", () => {
    assert.equal(toMarkdown([{ id: "d", component: "Divider" }]), "---");
  });

  it("converts multiple components", () => {
    const md = toMarkdown([
      { id: "h", component: "Text", text: "Hi", variant: "h1" },
      { id: "b", component: "Text", text: "body" },
    ]);
    assert.equal(md, "# Hi\nbody");
  });
});

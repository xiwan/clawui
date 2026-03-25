import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ActionRouter } from "../src/actions/router.js";

describe("ActionRouter", () => {
  it("resolves tool action with argMapping", () => {
    const router = new ActionRouter();
    router.register("main", {
      confirm: {
        tool: "message",
        action: "send",
        argMapping: { message: "Booked {{context.restaurant}}" },
      },
    });
    const result = router.resolve("main", "confirm", { restaurant: "Pasta House" });
    assert.equal(result?.type, "tool");
    if (result?.type === "tool") {
      assert.equal(result.tool, "message");
      assert.equal(result.args.message, "Booked Pasta House");
    }
  });

  it("resolves builtin action", () => {
    const router = new ActionRouter();
    router.register("main", { cancel: { builtin: "surface.close" } });
    const result = router.resolve("main", "cancel", {});
    assert.equal(result?.type, "builtin");
    if (result?.type === "builtin") assert.equal(result.name, "surface.close");
  });

  it("returns null for unknown action", () => {
    const router = new ActionRouter();
    assert.equal(router.resolve("main", "nope", {}), null);
  });

  it("scopes actions by surfaceId", () => {
    const router = new ActionRouter();
    router.register("s1", { go: { tool: "web_search", argMapping: { query: "test" } } });
    assert.ok(router.resolve("s1", "go", {}));
    assert.equal(router.resolve("s2", "go", {}), null);
  });

  it("clears actions for a surface", () => {
    const router = new ActionRouter();
    router.register("main", { x: { builtin: "surface.close" } });
    router.clear("main");
    assert.equal(router.resolve("main", "x", {}), null);
  });
});

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as registry from "../src/templates/registry.js";
import { render } from "../src/templates/engine.js";

// 注册内置模板
import textDisplay from "../src/templates/builtin/text_display.json" with { type: "json" };
import form from "../src/templates/builtin/form.json" with { type: "json" };
import confirmation from "../src/templates/builtin/confirmation.json" with { type: "json" };
import bookingForm from "../src/templates/builtin/booking_form.json" with { type: "json" };
import searchResults from "../src/templates/builtin/search_results.json" with { type: "json" };
import dashboard from "../src/templates/builtin/dashboard.json" with { type: "json" };
import settings from "../src/templates/builtin/settings.json" with { type: "json" };
registry.registerAll([textDisplay, form, confirmation, bookingForm, searchResults, dashboard, settings] as any);

describe("registry", () => {
  it("lists all 7 built-in templates", () => {
    const names = registry.list();
    for (const id of ["text_display", "form", "confirmation", "booking_form", "search_results", "dashboard", "settings"]) {
      assert.ok(names.includes(id), `missing ${id}`);
    }
  });
});

describe("engine — text_display", () => {
  it("renders with data binding", () => {
    const { components } = render({ template: "text_display", data: { title: "Hello", text: "World" } });
    assert.equal(components.find((c) => c.id === "header")?.text, "Hello");
    assert.equal(components.find((c) => c.id === "body")?.text, "World");
  });
});

describe("engine — form", () => {
  it("expands dynamic fields", () => {
    const { components } = render({
      template: "form",
      data: { title: "Info", fields: [{ name: "email", label: "Email" }, { name: "age", label: "Age" }] },
    });
    assert.ok(components.find((c) => c.id === "field-email"));
    assert.ok(components.find((c) => c.id === "field-age"));
  });
});

describe("engine — confirmation", () => {
  it("renders title and message", () => {
    const { components, actions } = render({
      template: "confirmation",
      data: { title: "Delete?", message: "This is permanent", confirmLabel: "Yes", cancelLabel: "No" },
    });
    assert.equal(components.find((c) => c.id === "header")?.text, "Delete?");
    assert.equal(components.find((c) => c.id === "body")?.text, "This is permanent");
    assert.equal(components.find((c) => c.id === "confirm-label")?.text, "Yes");
    assert.equal(components.find((c) => c.id === "cancel-label")?.text, "No");
    assert.ok((actions as any).cancel?.builtin);
  });
});

describe("engine — booking_form", () => {
  it("renders restaurant fields", () => {
    const { components } = render({
      template: "booking_form",
      data: { title: "Book", restaurant: "Pasta House", date: "2026-03-25", time: "19:00", guests: 2 },
    });
    assert.equal(components.find((c) => c.id === "header")?.text, "Book");
    assert.ok(components.find((c) => c.id === "date-field"));
    assert.ok(components.find((c) => c.id === "guests-field"));
  });
});

describe("engine — search_results", () => {
  it("expands result cards", () => {
    const { components } = render({
      template: "search_results",
      data: { query: "pizza", results: [{ title: "Pizza Roma", subtitle: "4.5★", description: "Great" }] },
    });
    assert.equal(components.find((c) => c.id === "header")?.text, 'Results for "pizza"');
    const card = components.find((c) => c.id === "result-0");
    assert.equal(card?.title, "Pizza Roma");
  });
});

describe("engine — dashboard", () => {
  it("expands metric cards", () => {
    const { components } = render({
      template: "dashboard",
      data: { title: "Stats", metrics: [{ label: "Users", value: 1234 }, { label: "Revenue", value: "$5k" }] },
    });
    assert.equal(components.find((c) => c.id === "metric-0")?.title, "Users");
    assert.equal(components.find((c) => c.id === "metric-0-text")?.text, "1234");
    assert.equal(components.find((c) => c.id === "metric-1")?.title, "Revenue");
  });
});

describe("engine — settings", () => {
  it("expands toggle and text settings", () => {
    const { components } = render({
      template: "settings",
      data: {
        title: "Preferences",
        settings: [
          { name: "darkMode", label: "Dark Mode", type: "toggle" },
          { name: "apiKey", label: "API Key", type: "text" },
        ],
      },
    });
    const toggle = components.find((c) => c.id === "setting-0");
    assert.equal(toggle?.component, "Toggle");
    const text = components.find((c) => c.id === "setting-1");
    assert.equal(text?.component, "TextField");
  });
});

describe("engine — custom components", () => {
  it("renders with data binding", () => {
    const { components } = render({
      components: [{ id: "t", component: "Text", text: "{{msg}}" }],
      data: { msg: "hi" },
    });
    assert.equal(components[0].text, "hi");
  });

  it("throws on missing template", () => {
    assert.throws(() => render({ template: "nonexistent" }), /not found/);
  });
});

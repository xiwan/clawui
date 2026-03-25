/**
 * ClawUI Preview Server — HTTP 端点集成测试
 * 启动真实 server，通过 HTTP 请求验证所有端点
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { startServer, VERSION } from "../src/server.js";
import { registerAll } from "../src/templates/registry.js";

import textDisplay from "../src/templates/builtin/text_display.json" with { type: "json" };
import form from "../src/templates/builtin/form.json" with { type: "json" };
import confirmation from "../src/templates/builtin/confirmation.json" with { type: "json" };
import bookingForm from "../src/templates/builtin/booking_form.json" with { type: "json" };
import searchResults from "../src/templates/builtin/search_results.json" with { type: "json" };
import dashboard from "../src/templates/builtin/dashboard.json" with { type: "json" };
import settings from "../src/templates/builtin/settings.json" with { type: "json" };
import accordion from "../src/templates/builtin/accordion.json" with { type: "json" };

registerAll([textDisplay, form, confirmation, bookingForm, searchResults, dashboard, settings, accordion] as any);

const PORT = 19099;
let server: http.Server;

function req(method: string, path: string, body?: unknown): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const r = http.request({ hostname: "127.0.0.1", port: PORT, method, path, headers: body ? { "Content-Type": "application/json" } : {} }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => {
        const text = Buffer.concat(chunks).toString();
        let parsed: any;
        try { parsed = JSON.parse(text); } catch { parsed = text; }
        resolve({ status: res.statusCode!, body: parsed });
      });
    });
    r.on("error", reject);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

function sseRead(path: string, ms: number): Promise<string[]> {
  return new Promise((resolve) => {
    const events: string[] = [];
    const r = http.get({ hostname: "127.0.0.1", port: PORT, path }, (res) => {
      res.on("data", (c) => {
        const line = c.toString().trim();
        if (line.startsWith("data:")) events.push(line);
      });
    });
    setTimeout(() => { r.destroy(); resolve(events); }, ms);
  });
}

describe("Preview Server", () => {
  before(() => { server = startServer(PORT); });
  after(() => { server.close(); });

  // --- GET endpoints ---

  it("GET /version", async () => {
    const { status, body } = await req("GET", "/version");
    assert.equal(status, 200);
    assert.equal(body.name, "@openclaw/clawui");
    assert.equal(body.version, VERSION);
  });

  it("GET / returns HTML", async () => {
    const { status, body } = await req("GET", "/");
    assert.equal(status, 200);
    assert.ok(typeof body === "string");
    assert.ok(body.includes("ClawUI"));
  });

  it("GET /api/agents returns demo agent", async () => {
    const { status, body } = await req("GET", "/api/agents");
    assert.equal(status, 200);
    assert.ok(Array.isArray(body.agents));
    assert.ok(body.agents.length > 0);
  });

  it("GET /nonexistent returns 404", async () => {
    const { status } = await req("GET", "/nonexistent");
    assert.equal(status, 404);
  });

  // --- POST /render ---

  it("POST /render with form template", async () => {
    const { status, body } = await req("POST", "/render", {
      template: "form",
      data: { title: "Test", fields: [{ name: "Name", type: "text" }] },
    });
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.ok(body.fallbackMarkdown);
  });

  it("POST /render with confirmation template", async () => {
    const { status, body } = await req("POST", "/render", {
      template: "confirmation",
      data: { title: "Deploy?", message: "确认部署?" },
    });
    assert.equal(status, 200);
    assert.equal(body.ok, true);
  });

  it("POST /render with dashboard template", async () => {
    const { status, body } = await req("POST", "/render", {
      template: "dashboard",
      data: { title: "数据", metrics: [{ label: "UV", value: "1000" }] },
    });
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.ok(body.fallbackMarkdown.includes("UV"));
  });

  it("POST /render with search_results template", async () => {
    const { status, body } = await req("POST", "/render", {
      template: "search_results",
      data: { query: "test", results: [{ title: "Result 1", snippet: "desc" }] },
    });
    assert.equal(status, 200);
    assert.equal(body.ok, true);
  });

  it("POST /render with custom components", async () => {
    const { status, body } = await req("POST", "/render", {
      components: [
        { id: "root", component: "Text", text: "hello", variant: "h1" },
      ],
    });
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.ok(body.fallbackMarkdown.includes("hello"));
  });

  it("POST /render with unknown template returns 500", async () => {
    const { status, body } = await req("POST", "/render", { template: "nonexistent" });
    assert.equal(status, 500);
    assert.equal(body.ok, false);
    assert.ok(body.error.includes("not found"));
  });

  it("POST /render with invalid JSON returns 500", async () => {
    // 发送非法 body
    const { status, body } = await new Promise<{ status: number; body: any }>((resolve, reject) => {
      const r = http.request({ hostname: "127.0.0.1", port: PORT, method: "POST", path: "/render", headers: { "Content-Type": "application/json" } }, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve({ status: res.statusCode!, body: JSON.parse(Buffer.concat(chunks).toString()) }));
      });
      r.on("error", reject);
      r.write("not json");
      r.end();
    });
    assert.equal(status, 500);
    assert.equal(body.ok, false);
  });

  // --- POST /push ---

  it("POST /push broadcasts JSONL", async () => {
    const jsonl = '{"surfaceUpdate":{"surfaceId":"test","components":[]}}';
    const { status, body } = await req("POST", "/push", undefined);
    // push 接受 raw body，这里简单验证端点可达
    assert.equal(status, 200);
  });

  // --- POST /action (demo mode) ---

  it("POST /action submit in demo mode", async () => {
    const { status, body } = await req("POST", "/action", {
      name: "submit", surfaceId: "main", agent: "demo", context: { text: "测试" },
    });
    assert.equal(status, 200);
    assert.equal(body.ok, true);
    assert.equal(body.action, "submit");
  });

  it("POST /action confirm in demo mode", async () => {
    const { status, body } = await req("POST", "/action", {
      name: "confirm", surfaceId: "main", agent: "demo", context: {},
    });
    assert.equal(status, 200);
    assert.equal(body.ok, true);
  });

  it("POST /action cancel in demo mode", async () => {
    const { status, body } = await req("POST", "/action", {
      name: "cancel", surfaceId: "main", agent: "demo", context: {},
    });
    assert.equal(status, 200);
    assert.equal(body.ok, true);
  });

  // --- SSE ---

  it("GET /events returns SSE stream", async () => {
    // 先 render 一次确保有数据
    await req("POST", "/render", {
      template: "dashboard",
      data: { title: "SSE Test", metrics: [{ label: "X", value: "1" }] },
    });
    const events = await sseRead("/events", 500);
    assert.ok(events.length > 0, "should receive at least one SSE event");
    const payload = JSON.parse(events[0].replace("data: ", ""));
    assert.ok(payload.jsonl);
  });

  // --- Demo 状态流转 ---

  it("demo flow: submit → review (after 2s) → confirm → idle", async () => {
    // submit → working
    const r1 = await req("POST", "/action", {
      name: "submit", surfaceId: "main", agent: "demo", context: { text: "flow test" },
    });
    assert.equal(r1.body.ok, true);

    // 等 review 态（demo 2 秒后切换）
    await new Promise((r) => setTimeout(r, 2500));

    // confirm → done → idle
    const r2 = await req("POST", "/action", {
      name: "confirm", surfaceId: "main", agent: "demo", context: {},
    });
    assert.equal(r2.body.ok, true);
  });
});

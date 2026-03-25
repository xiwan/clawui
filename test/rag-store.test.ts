import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { VectorStore } from "../src/rag/store.ts";

// 不调 S3，只测内存逻辑
function makeStore(): VectorStore {
  // @ts-ignore — 跳过 S3 init，直接用内存
  const store = new VectorStore({ bucket: "test", region: "us-east-1" });
  return store;
}

function vec(seed: number, dim = 8): number[] {
  const v = [];
  for (let i = 0; i < dim; i++) v.push(Math.sin(seed * (i + 1)));
  return v;
}

describe("VectorStore", () => {
  it("add and search returns match above threshold", () => {
    const store = makeStore();
    store.add({ id: "1", text: "hello", embedding: vec(1), renderResult: {}, agentId: "a", hitCount: 0, createdAt: "" });
    const results = store.search(vec(1), 1, 0.9);
    assert.equal(results.length, 1);
    assert.ok(results[0].score >= 0.99); // same vector = ~1.0
  });

  it("search filters below threshold", () => {
    const store = makeStore();
    store.add({ id: "1", text: "a", embedding: vec(1), renderResult: {}, agentId: "a", hitCount: 0, createdAt: "" });
    const results = store.search(vec(99), 1, 0.95);
    assert.equal(results.length, 0);
  });

  it("search returns top-k sorted by score", () => {
    const store = makeStore();
    store.add({ id: "1", text: "a", embedding: vec(1), renderResult: {}, agentId: "a", hitCount: 0, createdAt: "" });
    store.add({ id: "2", text: "b", embedding: vec(1.01), renderResult: {}, agentId: "a", hitCount: 0, createdAt: "" });
    store.add({ id: "3", text: "c", embedding: vec(99), renderResult: {}, agentId: "a", hitCount: 0, createdAt: "" });
    const results = store.search(vec(1), 2, 0.5);
    assert.equal(results.length, 2);
    assert.ok(results[0].score >= results[1].score);
    assert.equal(results[0].entry.id, "1");
  });

  it("hit increments hitCount", () => {
    const store = makeStore();
    store.add({ id: "1", text: "a", embedding: vec(1), renderResult: {}, agentId: "a", hitCount: 0, createdAt: "" });
    store.hit("1");
    store.hit("1");
    const results = store.search(vec(1), 1, 0.5);
    assert.equal(results[0].entry.hitCount, 2);
  });

  it("add with same id overwrites", () => {
    const store = makeStore();
    store.add({ id: "1", text: "old", embedding: vec(1), renderResult: {}, agentId: "a", hitCount: 0, createdAt: "" });
    store.add({ id: "1", text: "new", embedding: vec(2), renderResult: {}, agentId: "a", hitCount: 0, createdAt: "" });
    assert.equal(store.size, 1);
    const results = store.search(vec(2), 1, 0.5);
    assert.equal(results[0].entry.text, "new");
  });

  it("search with zero vector returns empty", () => {
    const store = makeStore();
    store.add({ id: "1", text: "a", embedding: vec(1), renderResult: {}, agentId: "a", hitCount: 0, createdAt: "" });
    const results = store.search(new Array(8).fill(0), 1, 0.5);
    assert.equal(results.length, 0);
  });
});

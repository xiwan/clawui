/**
 * RAG 意图匹配器 — 串联 embedder + store，提供 match / learn 接口
 */

import { Embedder, type EmbedderConfig } from "./embedder.js";
import { VectorStore, type StoreConfig, type VectorEntry } from "./store.js";
import { randomUUID } from "node:crypto";

export interface MatchResult {
  hit: boolean;
  entry?: VectorEntry;
  score?: number;
}

export interface RagConfig {
  enabled: boolean;
  embedder?: EmbedderConfig;
  store: StoreConfig;
  threshold?: number;
}

export class IntentMatcher {
  private embedder: Embedder;
  private store: VectorStore;
  private threshold: number;
  private ready = false;
  private initPromise: Promise<void> | null = null;

  constructor(cfg: RagConfig) {
    this.embedder = new Embedder(cfg.embedder);
    this.store = new VectorStore(cfg.store);
    this.threshold = cfg.threshold ?? 0.85;
  }

  /** 异步初始化：从 S3 加载索引 */
  async init(): Promise<void> {
    if (this.ready) return;
    if (!this.initPromise) {
      this.initPromise = this.store.load().then(() => { this.ready = true; });
    }
    return this.initPromise;
  }

  /** 匹配：用户输入 → embedding → 搜索相似意图 */
  async match(text: string): Promise<MatchResult> {
    await this.init();
    // 每次 match 前重新加载 S3（可能被其他进程更新）
    await this.store.load();
    const embedding = await this.embedder.embedText(text);
    const results = this.store.search(embedding, 1, this.threshold);
    if (results.length > 0) {
      this.store.hit(results[0].entry.id);
      this.store.save().catch(() => {}); // 异步写回
      return { hit: true, entry: results[0].entry, score: results[0].score };
    }
    return { hit: false };
  }

  /** 学习：Agent 渲染后，将 输入+渲染结果 存入向量库 */
  async learn(text: string, renderResult: unknown, agentId: string, userQuery?: string): Promise<void> {
    await this.init();
    // 按文本去重：相同文本只更新 renderResult
    const existing = this.store.findByText(text);
    if (existing) {
      existing.renderResult = renderResult;
      existing.createdAt = new Date().toISOString();
      this.store.markDirty();
      await this.store.save();
      return;
    }
    const embedding = await this.embedder.embedText(text);
    this.store.add({
      id: randomUUID(),
      text,
      embedding,
      renderResult,
      agentId,
      hitCount: 0,
      createdAt: new Date().toISOString(),
      userQuery: userQuery || text,
    });
    await this.store.save();
  }

  get size(): number { return this.store.size; }
}

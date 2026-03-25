/**
 * S3 向量存储 — 用 S3 JSON 文件存储 embedding 索引
 * 启动时加载到内存，变更时异步写回 S3
 */

export interface VectorEntry {
  id: string;
  text: string;
  embedding: number[];
  renderResult: unknown;
  agentId: string;
  hitCount: number;
  createdAt: string;
  /** 原始用户查询（replay 策略用） */
  userQuery?: string;
}

export interface StoreConfig {
  region?: string;
  bucket: string;
  key?: string;
}

export class VectorStore {
  private region: string;
  private bucket: string;
  private key: string;
  private entries: VectorEntry[] = [];
  private client: any;
  private dirty = false;

  constructor(cfg: StoreConfig) {
    this.region = cfg.region || "us-east-1";
    this.bucket = cfg.bucket;
    this.key = cfg.key || "clawui-rag/index.json";
  }

  private async getClient() {
    if (!this.client) {
      const { S3Client, GetObjectCommand, PutObjectCommand } = await import("@aws-sdk/client-s3");
      this.client = { instance: new S3Client({ region: this.region }), Get: GetObjectCommand, Put: PutObjectCommand };
    }
    return this.client;
  }

  async load(): Promise<void> {
    try {
      const { instance, Get } = await this.getClient();
      const resp = await instance.send(new Get({ Bucket: this.bucket, Key: this.key }));
      const body = await resp.Body?.transformToString();
      if (body) this.entries = JSON.parse(body);
    } catch (e: any) {
      if (e.name === "NoSuchKey" || e.Code === "NoSuchKey") {
        this.entries = [];
      } else {
        throw e;
      }
    }
  }

  async save(): Promise<void> {
    if (!this.dirty) return;
    const { instance, Put } = await this.getClient();
    await instance.send(new Put({
      Bucket: this.bucket,
      Key: this.key,
      Body: JSON.stringify(this.entries),
      ContentType: "application/json",
    }));
    this.dirty = false;
  }

  add(entry: VectorEntry): void {
    // 去重：相同 id 覆盖
    const idx = this.entries.findIndex(e => e.id === entry.id);
    if (idx >= 0) this.entries[idx] = entry;
    else this.entries.push(entry);
    this.dirty = true;
  }

  /** 余弦相似度搜索，返回 top-k */
  search(queryEmbedding: number[], topK = 3, threshold = 0.75): { entry: VectorEntry; score: number }[] {
    const results: { entry: VectorEntry; score: number }[] = [];
    const qNorm = norm(queryEmbedding);
    if (qNorm === 0) return [];

    for (const entry of this.entries) {
      const score = dot(queryEmbedding, entry.embedding) / (qNorm * norm(entry.embedding));
      if (score >= threshold) results.push({ entry, score });
    }

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, topK);
  }

  get size(): number { return this.entries.length; }

  findByText(text: string): VectorEntry | undefined {
    return this.entries.find(e => e.text === text);
  }

  markDirty(): void { this.dirty = true; }

  /** 增加命中计数 */
  hit(id: string): void {
    const e = this.entries.find(e => e.id === id);
    if (e) { e.hitCount++; this.dirty = true; }
  }
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function norm(v: number[]): number {
  let s = 0;
  for (let i = 0; i < v.length; i++) s += v[i] * v[i];
  return Math.sqrt(s);
}

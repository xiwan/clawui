/**
 * Titan Embed v2 — 调用 Bedrock amazon.titan-embed-text-v2:0
 */

export interface EmbedderConfig {
  region?: string;
  modelId?: string;
  dimension?: number;
}

const DEFAULT_MODEL = "amazon.titan-embed-text-v2:0";
const DEFAULT_REGION = "us-east-1";
const DEFAULT_DIM = 1024;

export class Embedder {
  private region: string;
  private modelId: string;
  private dimension: number;
  private client: any;

  constructor(cfg?: EmbedderConfig) {
    this.region = cfg?.region || DEFAULT_REGION;
    this.modelId = cfg?.modelId || DEFAULT_MODEL;
    this.dimension = cfg?.dimension || DEFAULT_DIM;
  }

  private async getClient() {
    if (!this.client) {
      const { BedrockRuntimeClient, InvokeModelCommand } = await import("@aws-sdk/client-bedrock-runtime");
      this.client = { Command: InvokeModelCommand, instance: new BedrockRuntimeClient({ region: this.region }) };
    }
    return this.client;
  }

  async embedText(text: string): Promise<number[]> {
    const { instance, Command } = await this.getClient();
    const body = JSON.stringify({
      inputText: text,
      dimensions: this.dimension,
    });
    const resp = await instance.send(new Command({
      modelId: this.modelId,
      contentType: "application/json",
      accept: "application/json",
      body,
    }));
    const result = JSON.parse(new TextDecoder().decode(resp.body));
    return result.embedding;
  }
}

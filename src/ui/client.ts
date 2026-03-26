/** ClawUI AgentOS 前端 JS — 从 client.js 读取，替换 basePath 占位符 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(join(__dir, "client.txt"), "utf-8");

export function clientScript(basePath: string): string {
  return raw.replace('%%BASE_PATH%%', basePath);
}

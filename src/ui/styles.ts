/** ClawUI AgentOS 界面样式 — 从 styles.css 读取 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
export const CSS = readFileSync(join(__dir, "styles.css"), "utf-8");

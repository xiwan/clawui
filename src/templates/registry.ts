/**
 * 模板注册表 — 加载和查找模板
 */

export interface Template {
  id: string;
  version: string;
  description: string;
  catalogId?: string;
  dataSchema?: Record<string, string>;
  components: Record<string, unknown>[];
  defaultActions?: Record<string, unknown>;
}

const templates = new Map<string, Template>();

export function register(tpl: Template): void {
  templates.set(tpl.id, tpl);
}

export function get(id: string): Template | undefined {
  return templates.get(id);
}

export function list(): string[] {
  return [...templates.keys()];
}

/** 从 JSON 对象批量注册 */
export function registerAll(tpls: Template[]): void {
  for (const t of tpls) register(t);
}

/** 从目录加载自定义模板 JSON 文件 */
export async function loadFromDir(dir: string): Promise<number> {
  const { readdir, readFile } = await import("node:fs/promises");
  const { join } = await import("node:path");
  let count = 0;
  let entries: string[];
  try {
    entries = await readdir(dir);
  } catch {
    return 0;
  }
  for (const file of entries) {
    if (!file.endsWith(".json")) continue;
    try {
      const content = await readFile(join(dir, file), "utf-8");
      const tpl = JSON.parse(content) as Template;
      if (tpl.id && tpl.components) {
        register(tpl);
        count++;
      }
    } catch { /* skip invalid files */ }
  }
  return count;
}

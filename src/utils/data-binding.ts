/**
 * 模板变量替换
 * - {{var}} 静态替换（渲染时）
 * - {{context.var}} action argMapping 替换
 */

/** 递归替换对象中所有 {{key}} 为 data 中的值 */
export function bindData(obj: unknown, data: Record<string, unknown>): unknown {
  if (typeof obj === "string") {
    return obj.replace(/\{\{([^}]+)\}\}/g, (_, key: string) => {
      const val = resolvePath(data, key.trim());
      return val != null ? String(val) : "";
    });
  }
  if (Array.isArray(obj)) return obj.map((item) => bindData(item, data));
  if (obj && typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = bindData(v, data);
    return out;
  }
  return obj;
}

/** 点分路径取值: "context.name" → data.context.name */
function resolvePath(data: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((cur, key) => {
    if (cur && typeof cur === "object") return (cur as Record<string, unknown>)[key];
    return undefined;
  }, data);
}

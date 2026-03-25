/**
 * A2UI → Markdown 降级
 * 无 canvas 客户端（Discord/飞书/Telegram）回退为文字卡片
 */

import type { A2UIComponent } from "../utils/jsonl.js";

/** 将 A2UI 组件列表降级为 Markdown */
export function toMarkdown(components: A2UIComponent[]): string {
  const byId = new Map<string, A2UIComponent>();
  for (const c of components) byId.set(c.id, c);
  return components.map((c) => componentToMd(c, byId)).filter(Boolean).join("\n");
}

function resolveText(idOrText: unknown, byId: Map<string, A2UIComponent>): string {
  if (typeof idOrText !== "string") return "";
  const child = byId.get(idOrText);
  if (child?.component === "Text") return (child.text as string) || "";
  return idOrText;
}

function componentToMd(c: A2UIComponent, byId: Map<string, A2UIComponent>): string {
  switch (c.component) {
    case "Text": {
      const text = c.text as string;
      if (c.variant === "h1") return `# ${text}`;
      if (c.variant === "h2") return `## ${text}`;
      if (c.variant === "h3") return `### ${text}`;
      return text;
    }
    case "Button": {
      const label = resolveText(c.child, byId);
      return label ? `[${label}]` : "";
    }
    case "TextField":
      return `📝 ${c.label}: ___`;
    case "DateTimeInput":
      return `📅 ${c.label}: ${c.value && typeof c.value === "object" ? (c.value as Record<string, unknown>).path : c.value || "___"}`;
    case "Card":
      return `> 📋 ${c.title || resolveText(c.child, byId)}`;
    case "Image":
      return `🖼️ ${c.alt || "image"}`;
    case "Toggle":
      return `🔘 ${c.label}: ${c.value ? "ON" : "OFF"}`;
    case "Select":
      return `📋 ${c.label}: [${(c.options as string[] || []).join(" | ")}]`;
    case "Divider":
      return "---";
    case "ProgressBar": {
      const pct = Math.round(((c.value as number) || 0) * 100);
      return `⏳ ${c.label || "Progress"}: ${pct}%`;
    }
    case "StatusIndicator":
      return `● ${c.text || c.status}`;
    case "Spacer":
      return "";
    case "Column":
    case "Row":
      return "";
    default:
      return "";
  }
}

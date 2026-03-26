/**
 * A2UI v0.8 JSONL 生成
 * 每行一个 JSON 消息，通过 canvas a2ui_push 推送
 */

export interface A2UIComponent {
  id: string;
  component: string;
  [key: string]: unknown;
}

/**
 * 将 ClawUI 内部组件格式转换为 A2UI v0.8 组件格式
 * v0.8: component: { Text: { text: { literalString: "..." }, usageHint: "body" } }
 * ClawUI: component: "Text", text: "hello", variant: "h1"
 */
function toV08Component(c: A2UIComponent): { id: string; component: Record<string, unknown> } {
  const type = c.component;
  const props: Record<string, unknown> = {};

  switch (type) {
    case "Text":
      props.text = { literalString: c.text as string || "" };
      props.usageHint = c.variant === "h1" ? "h1" : c.variant === "h2" ? "h2" : c.variant === "h3" ? "h3" : "body";
      if (c.accordion_body) props.accordion_body = true;
      break;
    case "Button":
      if (c.child) props.child = c.child;
      if (c.action) {
        const act = c.action as { event?: { name: string; context?: Record<string, unknown> } };
        if (act.event) props.action = { name: act.event.name };
      }
      if (c.accordion) props.accordion = true;
      break;
    case "TextField":
      if (c.label) props.label = { literalString: c.label as string };
      if (c.value && typeof c.value === "object") props.text = c.value;
      props.usageHint = "shortText";
      break;
    case "DateTimeInput":
      if (c.label) props.label = { literalString: c.label as string };
      if (c.value && typeof c.value === "object") props.value = c.value;
      if (c.enableDate) props.enableDate = c.enableDate;
      if (c.enableTime) props.enableTime = c.enableTime;
      break;
    case "Column":
    case "Row":
      if (Array.isArray(c.children)) props.children = { explicitList: c.children };
      break;
    case "Card":
      if (c.child) props.child = c.child;
      if (Array.isArray(c.children)) props.children = { explicitList: c.children };
      if (c.title) props.title = { literalString: c.title as string };
      if (c.clickAction) props.clickAction = c.clickAction;
      break;
    case "Image":
      if (c.url) props.url = { literalString: c.url as string };
      if (c.alt) props.description = { literalString: c.alt as string };
      break;
    case "Toggle":
      if (c.label) props.label = { literalString: c.label as string };
      if (c.value && typeof c.value === "object") props.value = c.value;
      break;
    case "Divider":
      break;
    case "ProgressBar":
      if (c.value != null) props.value = c.value;
      if (c.label) props.label = { literalString: c.label as string };
      break;
    case "StatusIndicator":
      if (c.status) props.status = c.status;
      if (c.text) props.text = { literalString: c.text as string };
      break;
    case "Spacer":
      if (c.size) props.size = c.size;
      break;
    default:
      Object.assign(props, c);
      delete (props as Record<string, unknown>).id;
      delete (props as Record<string, unknown>).component;
      break;
  }

  if (c.style) props.style = c.style;
  return { id: c.id, component: { [type]: props } };
}

/** 生成完整的 A2UI v0.8 JSONL：surfaceUpdate + dataModelUpdate + beginRendering */
export function generateJsonl(
  surfaceId: string,
  components: A2UIComponent[],
  dataModel?: Record<string, unknown>,
  catalogId?: string,
): string {
  const v08Components = components.map(toV08Component);
  const rootId = v08Components[0]?.id || "root";

  const lines: string[] = [
    JSON.stringify({
      surfaceUpdate: { surfaceId, components: v08Components },
    }),
  ];

  if (dataModel) {
    for (const [key, value] of Object.entries(dataModel)) {
      lines.push(JSON.stringify({
        dataModelUpdate: { surfaceId, path: `/${key}`, op: "replace", value },
      }));
    }
  }

  lines.push(JSON.stringify({
    beginRendering: { surfaceId, root: rootId, ...(catalogId ? { catalogId } : {}) },
  }));

  return lines.join("\n");
}

/**
 * ClawUI Renderer — A2UI JSON → DOM
 * 轻量渲染器，将 A2UI v0.9 消息渲染为 Web 界面
 */

interface A2UIMessage {
  version: string;
  createSurface?: { surfaceId: string; catalogId: string };
  updateComponents?: { surfaceId: string; components: Component[] };
  updateDataModel?: { surfaceId: string; path: string; value: unknown };
  deleteSurface?: { surfaceId: string };
}

interface Component {
  id: string;
  component: string;
  [key: string]: unknown;
}

type ActionCallback = (name: string, surfaceId: string, context: Record<string, unknown>) => void;

class ClawUIRenderer {
  private container: HTMLElement;
  private surfaces: Map<string, HTMLElement> = new Map();
  private dataModels: Map<string, Record<string, unknown>> = new Map();
  private onAction: ActionCallback;

  constructor(container: HTMLElement, onAction: ActionCallback) {
    this.container = container;
    this.onAction = onAction;
  }

  /** Process a single A2UI message */
  process(msg: A2UIMessage): void {
    if (msg.createSurface) {
      const el = document.createElement("div");
      el.className = "surface";
      el.dataset.surfaceId = msg.createSurface.surfaceId;
      this.container.appendChild(el);
      this.surfaces.set(msg.createSurface.surfaceId, el);
      this.dataModels.set(msg.createSurface.surfaceId, {});
    }

    if (msg.updateComponents) {
      const el = this.surfaces.get(msg.updateComponents.surfaceId);
      if (!el) return;
      el.innerHTML = "";
      for (const c of msg.updateComponents.components) {
        el.appendChild(this.renderComponent(c, msg.updateComponents.surfaceId));
      }
    }

    if (msg.updateDataModel) {
      const model = this.dataModels.get(msg.updateDataModel.surfaceId) || {};
      this.setPath(model, msg.updateDataModel.path, msg.updateDataModel.value);
      this.dataModels.set(msg.updateDataModel.surfaceId, model);
    }

    if (msg.deleteSurface) {
      const el = this.surfaces.get(msg.deleteSurface.surfaceId);
      el?.remove();
      this.surfaces.delete(msg.deleteSurface.surfaceId);
      this.dataModels.delete(msg.deleteSurface.surfaceId);
    }
  }

  private renderComponent(c: Component, surfaceId: string): HTMLElement {
    switch (c.component) {
      case "Text": {
        const tag = c.variant === "h1" ? "h2" : c.variant === "h2" ? "h3" : "p";
        const el = document.createElement(tag);
        el.textContent = c.text as string;
        return el;
      }
      case "Button": {
        const btn = document.createElement("button");
        btn.textContent = c.child as string;
        btn.style.cssText = "padding:8px 16px;border-radius:6px;border:none;background:#4f46e5;color:#fff;cursor:pointer;margin:4px 0";
        const action = c.action as { event?: { name: string; context?: Record<string, unknown> } } | undefined;
        if (action?.event) {
          btn.addEventListener("click", () => this.onAction(action.event!.name, surfaceId, action.event!.context || {}));
        }
        return btn;
      }
      case "TextField": {
        const wrap = document.createElement("div");
        wrap.style.cssText = "margin:8px 0";
        const label = document.createElement("label");
        label.textContent = c.label as string;
        label.style.cssText = "display:block;margin-bottom:4px;font-size:0.9em;color:#aaa";
        const input = document.createElement("input");
        input.type = "text";
        input.style.cssText = "width:100%;padding:8px;border-radius:6px;border:1px solid #333;background:#222;color:#e0e0e0";
        wrap.append(label, input);
        return wrap;
      }
      case "Column": {
        const col = document.createElement("div");
        col.style.cssText = "display:flex;flex-direction:column;gap:8px";
        return col;
      }
      default: {
        const el = document.createElement("div");
        el.textContent = `[${c.component}: ${c.id}]`;
        return el;
      }
    }
  }

  private setPath(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = path.replace(/^\//, "").split("/");
    let cur: Record<string, unknown> = obj;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in cur)) cur[keys[i]] = {};
      cur = cur[keys[i]] as Record<string, unknown>;
    }
    cur[keys[keys.length - 1]] = value;
  }
}

// Init
const container = document.getElementById("surfaces");
if (container) {
  const renderer = new ClawUIRenderer(container, (name, surfaceId, context) => {
    console.log("Action:", { name, surfaceId, context });
    // TODO: POST to OpenClaw /tools/invoke
  });

  // Listen for SSE messages
  // TODO: connect to OpenClaw event stream
  (window as unknown as Record<string, unknown>).__clawui = renderer;
}

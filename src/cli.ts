/**
 * ClawUI CLI 命令
 * 通过 api.registerCli 注册到 OpenClaw CLI
 */

import * as registry from "./templates/registry.js";
import { executeRender } from "./tool.js";

interface Program {
  command(name: string): Command;
}

interface Command {
  description(desc: string): Command;
  argument(name: string, desc: string): Command;
  option(flags: string, desc: string): Command;
  action(fn: (...args: any[]) => void): Command;
}

export function registerCli(program: Program): void {
  program
    .command("clawui list")
    .description("List all available templates")
    .action(() => {
      const templates = registry.list();
      if (!templates.length) {
        console.log("No templates registered.");
        return;
      }
      for (const id of templates) {
        const tpl = registry.get(id);
        console.log(`  ${id}  — ${tpl?.description || ""}`);
      }
    });

  program
    .command("clawui preview")
    .description("Preview JSONL output for a template")
    .argument("<template>", "Template name")
    .option("--data <json>", "JSON data to fill template")
    .action((template: string, opts: { data?: string }) => {
      const data = opts.data ? JSON.parse(opts.data) : {};
      const result = executeRender({ template, data });
      console.log(result.jsonl);
    });

  program
    .command("clawui push")
    .description("Render and push template to a canvas node")
    .argument("<template>", "Template name")
    .option("--data <json>", "JSON data to fill template")
    .option("--node <node>", "Target node name")
    .action((template: string, opts: { data?: string; node?: string }) => {
      const data = opts.data ? JSON.parse(opts.data) : {};
      const result = executeRender({ template, data });
      // 实际推送由 api.canvas.a2uiPush 完成，这里输出 JSONL 供调试
      console.log(`[push to ${opts.node || "default"}]`);
      console.log(result.jsonl);
    });
}

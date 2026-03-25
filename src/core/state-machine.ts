/**
 * ClawUI 任务状态机
 * idle → working → review → done
 *                ↘ error
 */

export type TaskState = "idle" | "working" | "review" | "done" | "error";

export interface TaskContext {
  state: TaskState;
  taskId?: string;
  taskTitle?: string;
  progress?: number;
  statusText?: string;
  error?: { code?: string; message: string };
}

type Listener = (ctx: TaskContext, prev: TaskState) => void;

const TRANSITIONS: Record<TaskState, TaskState[]> = {
  idle: ["working"],
  working: ["review", "done", "error", "idle"],
  review: ["done", "working", "idle"],
  done: ["idle"],
  error: ["working", "idle"],
};

export class TaskStateMachine {
  private ctx: TaskContext = { state: "idle" };
  private listeners: Listener[] = [];

  get state(): TaskState { return this.ctx.state; }
  get context(): Readonly<TaskContext> { return this.ctx; }

  transition(to: TaskState, patch?: Partial<Omit<TaskContext, "state">>): boolean {
    if (!TRANSITIONS[this.ctx.state].includes(to)) return false;
    const prev = this.ctx.state;
    this.ctx = { ...this.ctx, ...patch, state: to };
    for (const fn of this.listeners) fn(this.ctx, prev);
    return true;
  }

  update(patch: Partial<Omit<TaskContext, "state">>): void {
    this.ctx = { ...this.ctx, ...patch };
  }

  onTransition(fn: Listener): () => void {
    this.listeners.push(fn);
    return () => { this.listeners = this.listeners.filter(l => l !== fn); };
  }

  reset(): void {
    const prev = this.ctx.state;
    this.ctx = { state: "idle" };
    if (prev !== "idle") for (const fn of this.listeners) fn(this.ctx, prev);
  }
}

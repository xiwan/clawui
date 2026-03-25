# DSL → A2UI 预编译转换层设计文档

> **版本**: v1.0
> **日期**: 2026-03-24
> **作者**: 佳佳
> **状态**: 设计稿

---

## 1. 设计目标

### 1.1 问题背景

AgentOS 场景下，LLM 根据用户输入实时生成 UI。当前痛点：
- LLM 直接输出完整 A2UI JSON，token 消耗大（500-2000 tokens）
- 生成延迟高（2-5 秒）
- 每次输出结构不一致，难以缓存

### 1.2 解决方案

引入 **DSL 中间层**：
- LLM 输出轻量 DSL（50-100 tokens）
- 预编译器将 DSL 确定性转换为 A2UI
- 转换过程无 LLM 调用，< 10ms

### 1.3 性能目标

| 指标 | 当前 | 目标 |
|-----|------|------|
| LLM 输出 tokens | 500-2000 | 50-150 |
| 端到端延迟 | 2-5s | 300-800ms |
| DSL → A2UI 转换 | N/A | < 10ms |

---

## 2. DSL Schema 设计

### 2.1 核心理念

1. **声明式**: 描述"要什么"，不描述"怎么做"
2. **最小化**: 只包含语义信息，样式/布局由预编译器处理
3. **可组合**: 支持嵌套，复杂页面由简单组件组合
4. **类型安全**: 完整 TypeScript 定义，便于校验

### 2.2 顶层结构

```typescript
interface UiDsl {
  // 页面布局
  layout: LayoutType;
  
  // 页面标题（可选）
  title?: string;
  
  // 组件列表
  widgets: Widget[];
  
  // 底部操作（可选）
  actions?: ActionDsl[];
  
  // 框架状态（可选，默认 working）
  frameState?: 'idle' | 'working' | 'review' | 'done' | 'error';
}

type LayoutType = 
  | 'single'    // 单列，自上而下
  | 'split'     // 左右分栏（默认 1:1）
  | 'split-3-7' // 左右分栏 3:7
  | 'split-7-3' // 左右分栏 7:3
  | 'grid-2'    // 2 列网格
  | 'grid-3'    // 3 列网格
  | 'stack'     // 堆叠（Tab 形式）
  | 'sidebar'   // 侧边栏 + 主内容
```

### 2.3 Widget 类型定义

```typescript
type Widget = 
  | CardWidget
  | FormWidget
  | TableWidget
  | ListWidget
  | ChartWidget
  | TextWidget
  | ImageWidget
  | StatusWidget
  | ProgressWidget
  | EmptyWidget;

// === 卡片组件 ===
interface CardWidget {
  type: 'card';
  props: {
    title?: string;
    subtitle?: string;
    icon?: string;           // 图标名
    content?: string;        // 纯文本内容
    children?: Widget[];     // 或嵌套组件
    footer?: string;
    clickAction?: string;    // 点击触发的 action
  };
}

// === 表单组件 ===
interface FormWidget {
  type: 'form';
  props: {
    id: string;              // 表单 ID，提交时用
    title?: string;
    fields: FormField[];
    submitLabel?: string;    // 默认 "提交"
    submitAction?: string;   // 默认 "submit"
  };
}

interface FormField {
  name: string;              // 字段名
  label: string;
  type: 'text' | 'textarea' | 'number' | 'email' | 'password' 
      | 'date' | 'time' | 'datetime' 
      | 'select' | 'radio' | 'checkbox' | 'switch' | 'slider';
  placeholder?: string;
  value?: any;               // 默认值
  options?: Option[];        // select/radio 的选项
  min?: number;              // number/slider 的最小值
  max?: number;              // number/slider 的最大值
  required?: boolean;
  disabled?: boolean;
}

interface Option {
  value: string;
  label: string;
}

// === 表格组件 ===
interface TableWidget {
  type: 'table';
  props: {
    title?: string;
    columns: TableColumn[];
    rows: Record<string, any>[];  // 数据行
    selectable?: boolean;         // 可选择
    actions?: RowAction[];        // 行操作按钮
    pagination?: {
      page: number;
      pageSize: number;
      total: number;
    };
  };
}

interface TableColumn {
  key: string;               // 对应 row 中的字段
  label: string;
  width?: string;            // 如 "120px" 或 "30%"
  align?: 'left' | 'center' | 'right';
}

interface RowAction {
  label: string;
  action: string;            // action 名称
  icon?: string;
  style?: 'default' | 'primary' | 'danger';
}

// === 列表组件 ===
interface ListWidget {
  type: 'list';
  props: {
    title?: string;
    items: ListItem[];
    selectable?: boolean;
    emptyText?: string;
  };
}

interface ListItem {
  id: string;
  title: string;
  subtitle?: string;
  icon?: string;
  avatar?: string;           // 头像 URL
  badge?: string;
  tags?: string[];
  clickAction?: string;
}

// === 图表组件 ===
interface ChartWidget {
  type: 'chart';
  props: {
    title?: string;
    chartType: 'line' | 'bar' | 'pie' | 'donut' | 'area';
    data: ChartData;
    height?: number;         // 默认 300
  };
}

interface ChartData {
  labels: string[];
  datasets: {
    name: string;
    values: number[];
    color?: string;
  }[];
}

// === 文本组件 ===
interface TextWidget {
  type: 'text';
  props: {
    content: string;
    variant?: 'h1' | 'h2' | 'h3' | 'body' | 'caption' | 'code';
    align?: 'left' | 'center' | 'right';
    color?: 'default' | 'muted' | 'primary' | 'success' | 'warning' | 'error';
  };
}

// === 图片组件 ===
interface ImageWidget {
  type: 'image';
  props: {
    src: string;
    alt?: string;
    width?: string;
    height?: string;
    fit?: 'cover' | 'contain' | 'fill';
    caption?: string;
  };
}

// === 状态指示组件 ===
interface StatusWidget {
  type: 'status';
  props: {
    status: 'success' | 'warning' | 'error' | 'info' | 'loading';
    title: string;
    message?: string;
    icon?: string;
  };
}

// === 进度组件 ===
interface ProgressWidget {
  type: 'progress';
  props: {
    value: number;           // 0-100
    label?: string;
    showValue?: boolean;     // 显示百分比
    variant?: 'linear' | 'circular';
  };
}

// === 空状态组件 ===
interface EmptyWidget {
  type: 'empty';
  props: {
    icon?: string;
    title: string;
    message?: string;
    action?: ActionDsl;      // 空状态下的操作按钮
  };
}
```

### 2.4 Action 定义

```typescript
interface ActionDsl {
  id: string;
  label: string;
  action: string;            // 触发的 action 名称
  style?: 'default' | 'primary' | 'danger' | 'text';
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
}
```

---

## 3. 预编译器设计

### 3.1 架构

```
┌─────────────────────────────────────────────────────────────┐
│                    DSL Compiler                             │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐  │
│  │ Parser  │───▶│Validator│───▶│Compiler │───▶│Optimizer│  │
│  │         │    │         │    │         │    │         │  │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘  │
│       ▲                             │                       │
│       │                             ▼                       │
│  ┌─────────┐                  ┌─────────────┐              │
│  │   DSL   │                  │   A2UI      │              │
│  │  JSON   │                  │   JSONL     │              │
│  └─────────┘                  └─────────────┘              │
│                                                             │
│  Components: ┌──────────────────────────────┐              │
│              │  Pre-compiled Templates      │              │
│              │  - CardTemplate              │              │
│              │  - FormTemplate              │              │
│              │  - TableTemplate             │              │
│              │  - ...                       │              │
│              └──────────────────────────────┘              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 预编译模板

每个 Widget 类型对应一个预编译模板函数：

```typescript
// templates/card.ts
export function compileCard(widget: CardWidget, idPrefix: string): A2UIComponent[] {
  const cardId = `${idPrefix}-card`;
  const components: A2UIComponent[] = [];
  
  // 卡片容器
  const children: string[] = [];
  
  // 标题区
  if (widget.props.title || widget.props.icon) {
    const headerId = `${cardId}-header`;
    children.push(headerId);
    components.push({
      id: headerId,
      component: {
        Row: {
          children: { explicitList: buildHeaderChildren(widget.props, cardId) },
          crossAxisAlignment: 'center'
        }
      }
    });
    
    if (widget.props.icon) {
      components.push({
        id: `${cardId}-icon`,
        component: { Icon: { name: widget.props.icon, size: 24 } }
      });
    }
    
    if (widget.props.title) {
      components.push({
        id: `${cardId}-title`,
        component: { Text: { text: widget.props.title, usageHint: 'h3' } }
      });
    }
    
    if (widget.props.subtitle) {
      components.push({
        id: `${cardId}-subtitle`,
        component: { Text: { text: widget.props.subtitle, usageHint: 'caption' } }
      });
    }
  }
  
  // 内容区
  if (widget.props.content) {
    const contentId = `${cardId}-content`;
    children.push(contentId);
    components.push({
      id: contentId,
      component: { Text: { text: widget.props.content } }
    });
  }
  
  // 嵌套子组件
  if (widget.props.children) {
    widget.props.children.forEach((child, i) => {
      const childId = `${cardId}-child-${i}`;
      children.push(childId);
      // 递归编译子组件
      components.push(...compileWidget(child, childId));
    });
  }
  
  // 卡片外壳
  components.unshift({
    id: cardId,
    component: {
      Card: {
        children: { explicitList: children },
        clickAction: widget.props.clickAction
      }
    }
  });
  
  return components;
}
```

### 3.3 布局编译

```typescript
// templates/layout.ts
export function compileLayout(dsl: UiDsl): A2UIComponent[] {
  const components: A2UIComponent[] = [];
  const rootChildren: string[] = [];
  
  switch (dsl.layout) {
    case 'single':
      // 单列：所有 widget 垂直排列
      dsl.widgets.forEach((widget, i) => {
        const widgetId = `widget-${i}`;
        rootChildren.push(widgetId);
        components.push(...compileWidget(widget, widgetId));
      });
      components.unshift({
        id: 'root',
        component: {
          Column: {
            children: { explicitList: rootChildren },
            spacing: 16
          }
        }
      });
      break;
      
    case 'split':
    case 'split-3-7':
    case 'split-7-3':
      // 分栏：前半 widgets 左边，后半右边
      const midpoint = Math.ceil(dsl.widgets.length / 2);
      const leftChildren: string[] = [];
      const rightChildren: string[] = [];
      
      dsl.widgets.forEach((widget, i) => {
        const widgetId = `widget-${i}`;
        if (i < midpoint) {
          leftChildren.push(widgetId);
        } else {
          rightChildren.push(widgetId);
        }
        components.push(...compileWidget(widget, widgetId));
      });
      
      const flexRatio = dsl.layout === 'split-3-7' ? [3, 7] 
                      : dsl.layout === 'split-7-3' ? [7, 3] 
                      : [1, 1];
      
      components.unshift(
        { id: 'root', component: { Row: { children: { explicitList: ['left-col', 'right-col'] }, spacing: 16 } } },
        { id: 'left-col', component: { Column: { children: { explicitList: leftChildren }, flex: flexRatio[0] } } },
        { id: 'right-col', component: { Column: { children: { explicitList: rightChildren }, flex: flexRatio[1] } } }
      );
      break;
      
    case 'grid-2':
    case 'grid-3':
      // 网格布局
      const cols = dsl.layout === 'grid-2' ? 2 : 3;
      const rows: string[][] = [];
      let currentRow: string[] = [];
      
      dsl.widgets.forEach((widget, i) => {
        const widgetId = `widget-${i}`;
        currentRow.push(widgetId);
        components.push(...compileWidget(widget, widgetId));
        
        if (currentRow.length === cols) {
          rows.push(currentRow);
          currentRow = [];
        }
      });
      if (currentRow.length > 0) rows.push(currentRow);
      
      const rowIds = rows.map((row, i) => `row-${i}`);
      rows.forEach((row, i) => {
        components.push({
          id: `row-${i}`,
          component: { Row: { children: { explicitList: row }, spacing: 16 } }
        });
      });
      
      components.unshift({
        id: 'root',
        component: { Column: { children: { explicitList: rowIds }, spacing: 16 } }
      });
      break;
      
    case 'stack':
      // Tab 堆叠
      const tabIds = dsl.widgets.map((_, i) => `tab-${i}`);
      const tabLabels = dsl.widgets.map((w, i) => 
        ('props' in w && 'title' in w.props) ? w.props.title : `Tab ${i + 1}`
      );
      
      dsl.widgets.forEach((widget, i) => {
        components.push(...compileWidget(widget, `tab-${i}-content`));
        components.push({
          id: `tab-${i}`,
          component: { 
            TabPanel: { 
              label: tabLabels[i],
              children: { explicitList: [`tab-${i}-content`] }
            }
          }
        });
      });
      
      components.unshift({
        id: 'root',
        component: { Tabs: { children: { explicitList: tabIds } } }
      });
      break;
  }
  
  return components;
}
```

### 3.4 完整编译流程

```typescript
// compiler.ts
export function compileDsl(dsl: UiDsl): A2UIOutput {
  // 1. 验证 DSL
  const validation = validateDsl(dsl);
  if (!validation.valid) {
    throw new Error(`DSL validation failed: ${validation.errors.join(', ')}`);
  }
  
  // 2. 编译布局和组件
  const canvasComponents = compileLayout(dsl);
  
  // 3. 编译 Header
  const headerComponents = compileHeader(dsl);
  
  // 4. 编译 Actions
  const actionsComponents = compileActions(dsl);
  
  // 5. 生成 A2UI JSONL
  const output: string[] = [];
  
  // Header surface
  if (headerComponents.length > 0) {
    output.push(JSON.stringify({
      surfaceUpdate: {
        surfaceId: 'header',
        components: headerComponents
      }
    }));
  }
  
  // Canvas surface
  output.push(JSON.stringify({
    surfaceUpdate: {
      surfaceId: 'canvas',
      components: canvasComponents
    }
  }));
  output.push(JSON.stringify({
    beginRendering: {
      surfaceId: 'canvas',
      root: 'root'
    }
  }));
  
  // Actions surface
  if (actionsComponents.length > 0) {
    output.push(JSON.stringify({
      surfaceUpdate: {
        surfaceId: 'actions',
        components: actionsComponents
      }
    }));
  }
  
  // Frame state
  if (dsl.frameState) {
    output.push(JSON.stringify({
      clawui: {
        frameState: {
          state: dsl.frameState
        }
      }
    }));
  }
  
  return {
    jsonl: output.join('\n'),
    componentCount: canvasComponents.length,
    compileTimeMs: performance.now() - startTime
  };
}
```

---

## 4. LLM Prompt 设计

### 4.1 System Prompt

```
你是 UI 配置生成器。根据用户需求，输出 JSON 格式的 UI 配置。

## 输出格式

只输出 JSON，不要输出其他内容。JSON 结构如下：

{
  "layout": "single|split|split-3-7|split-7-3|grid-2|grid-3|stack|sidebar",
  "title": "页面标题（可选）",
  "widgets": [...],
  "actions": [...]  // 可选
}

## 可用组件

1. card - 信息卡片
   {"type":"card","props":{"title":"标题","subtitle":"副标题","content":"内容","icon":"图标名"}}

2. form - 表单
   {"type":"form","props":{"id":"form-id","fields":[
     {"name":"字段名","label":"显示名","type":"text|textarea|number|date|select|checkbox","options":[...]}
   ]}}

3. table - 表格
   {"type":"table","props":{"columns":[{"key":"字段","label":"列名"}],"rows":[...]}}

4. list - 列表
   {"type":"list","props":{"items":[{"id":"1","title":"标题","subtitle":"描述"}]}}

5. chart - 图表
   {"type":"chart","props":{"chartType":"line|bar|pie","data":{"labels":[...],"datasets":[{"name":"","values":[]}]}}}

6. text - 文本
   {"type":"text","props":{"content":"内容","variant":"h1|h2|h3|body|caption"}}

7. status - 状态提示
   {"type":"status","props":{"status":"success|warning|error|info|loading","title":"标题","message":"描述"}}

8. progress - 进度
   {"type":"progress","props":{"value":75,"label":"加载中"}}

## 布局说明

- single: 单列垂直排列
- split: 左右两栏等宽
- split-3-7/split-7-3: 左右不等宽
- grid-2/grid-3: 2列或3列网格
- stack: Tab 标签页切换

## 示例

用户：显示销售数据
输出：
{"layout":"split","widgets":[{"type":"card","props":{"title":"今日销售","content":"¥128,500","icon":"trending-up"}},{"type":"chart","props":{"chartType":"bar","data":{"labels":["周一","周二","周三","周四","周五"],"datasets":[{"name":"销售额","values":[12000,19000,15000,25000,22000]}]}}}]}
```

### 4.2 Few-shot Examples

```json
// 例1：任务列表
{"layout":"single","title":"我的任务","widgets":[{"type":"list","props":{"items":[{"id":"1","title":"完成报告","subtitle":"截止：明天","tags":["紧急"]},{"id":"2","title":"团队会议","subtitle":"14:00-15:00"}],"selectable":true}}],"actions":[{"id":"add","label":"新建任务","action":"add-task","style":"primary"}]}

// 例2：数据仪表盘
{"layout":"grid-2","widgets":[{"type":"card","props":{"title":"用户数","content":"12,345","icon":"users"}},{"type":"card","props":{"title":"订单数","content":"892","icon":"shopping-cart"}},{"type":"chart","props":{"chartType":"line","data":{"labels":["1月","2月","3月"],"datasets":[{"name":"收入","values":[50000,65000,72000]}]}}},{"type":"table","props":{"title":"最近订单","columns":[{"key":"id","label":"订单号"},{"key":"amount","label":"金额"}],"rows":[{"id":"#001","amount":"¥299"},{"id":"#002","amount":"¥599"}]}}]}

// 例3：表单页面
{"layout":"single","title":"预订餐厅","widgets":[{"type":"form","props":{"id":"booking","fields":[{"name":"date","label":"日期","type":"date"},{"name":"time","label":"时间","type":"select","options":[{"value":"18:00","label":"18:00"},{"value":"19:00","label":"19:00"},{"value":"20:00","label":"20:00"}]},{"name":"guests","label":"人数","type":"number","min":1,"max":20},{"name":"notes","label":"备注","type":"textarea"}],"submitLabel":"提交预订"}}]}

// 例4：状态反馈
{"layout":"single","widgets":[{"type":"status","props":{"status":"success","title":"预订成功","message":"您已成功预订 3月25日 19:00 的餐位"}},{"type":"card","props":{"title":"预订详情","children":[{"type":"text","props":{"content":"餐厅：湘菜馆","variant":"body"}},{"type":"text","props":{"content":"时间：2026-03-25 19:00","variant":"body"}},{"type":"text","props":{"content":"人数：2位","variant":"body"}}]}}],"actions":[{"id":"calendar","label":"添加到日历","action":"add-to-calendar"},{"id":"done","label":"完成","action":"close","style":"primary"}]}
```

---

## 5. 缓存策略

### 5.1 语义缓存

```typescript
interface SemanticCache {
  // 用户意图 → DSL 映射
  intentToTemplate: Map<string, UiDsl>;
  
  // embedding 向量检索
  embeddings: VectorStore;
}

async function getCachedDsl(userInput: string): Promise<UiDsl | null> {
  // 1. 精确匹配
  const exactMatch = cache.intentToTemplate.get(normalize(userInput));
  if (exactMatch) return exactMatch;
  
  // 2. 语义相似度检索
  const embedding = await embed(userInput);
  const similar = await cache.embeddings.search(embedding, { threshold: 0.85 });
  
  if (similar.length > 0) {
    return similar[0].dsl;
  }
  
  return null;  // 无缓存，需要 LLM 生成
}
```

### 5.2 组件缓存

```typescript
// 编译后的 A2UI 组件缓存
const compiledCache = new LRUCache<string, A2UIComponent[]>({
  max: 1000,
  ttl: 1000 * 60 * 60  // 1 小时
});

function compileWithCache(widget: Widget, idPrefix: string): A2UIComponent[] {
  const cacheKey = hash(JSON.stringify(widget));
  
  const cached = compiledCache.get(cacheKey);
  if (cached) {
    // 复制并替换 id prefix
    return replaceIdPrefix(cached, idPrefix);
  }
  
  const compiled = compileWidget(widget, idPrefix);
  compiledCache.set(cacheKey, compiled);
  return compiled;
}
```

---

## 6. 降级策略

### 6.1 三层架构

```
┌─────────────────────────────────────────────────────┐
│ Layer 1: 规则引擎 (0-10ms)                          │
│ - 精确命令匹配：/settings → 设置页 DSL              │
│ - 关键词触发：包含"表格"→ 表格组件                   │
│ - 缓存命中：语义相似度 > 0.9                        │
├─────────────────────────────────────────────────────┤
│ Layer 2: 小模型分类 (50-200ms)                      │
│ - 意图分类：列表/表单/仪表盘/详情/状态              │
│ - 组件组合选择                                      │
│ - 使用轻量模型（如 Haiku）                         │
├─────────────────────────────────────────────────────┤
│ Layer 3: 大模型生成 (500ms+)                        │
│ - 复杂/创意场景                                     │
│ - 完整 DSL 生成                                     │
│ - 使用 Sonnet/Opus                                 │
└─────────────────────────────────────────────────────┘
```

### 6.2 流程

```typescript
async function generateDsl(userInput: string): Promise<UiDsl> {
  // Layer 1: 规则引擎
  const ruleResult = ruleEngine.match(userInput);
  if (ruleResult) {
    metrics.record('layer1_hit');
    return ruleResult;
  }
  
  // Layer 1: 语义缓存
  const cached = await getCachedDsl(userInput);
  if (cached) {
    metrics.record('cache_hit');
    return cached;
  }
  
  // Layer 2: 小模型分类
  const intent = await classifyIntent(userInput);  // 使用 Haiku
  const template = getTemplateForIntent(intent);
  if (template) {
    // 用小模型填充数据
    const filledTemplate = await fillTemplate(template, userInput);
    metrics.record('layer2_hit');
    return filledTemplate;
  }
  
  // Layer 3: 大模型生成
  const dsl = await generateFullDsl(userInput);  // 使用 Sonnet
  
  // 存入缓存
  await cache.store(userInput, dsl);
  
  metrics.record('layer3_hit');
  return dsl;
}
```

---

## 7. 流式渲染

### 7.1 骨架屏策略

```typescript
// 先渲染骨架，再填充内容
async function* streamRender(userInput: string): AsyncGenerator<string> {
  // 1. 立即返回骨架屏
  yield JSON.stringify({
    surfaceUpdate: {
      surfaceId: 'canvas',
      components: [
        { id: 'root', component: { Column: { children: { explicitList: ['skeleton'] } } } },
        { id: 'skeleton', component: { Skeleton: { lines: 5 } } }
      ]
    }
  });
  
  // 2. 生成 DSL（可能需要 LLM）
  const dsl = await generateDsl(userInput);
  
  // 3. 编译并返回真实内容
  const a2ui = compileDsl(dsl);
  yield a2ui.jsonl;
}
```

### 7.2 增量更新

```typescript
// 支持局部更新，而非整页刷新
function generateDiff(oldDsl: UiDsl, newDsl: UiDsl): A2UIUpdate[] {
  const updates: A2UIUpdate[] = [];
  
  // 比较每个 widget
  for (let i = 0; i < Math.max(oldDsl.widgets.length, newDsl.widgets.length); i++) {
    const oldWidget = oldDsl.widgets[i];
    const newWidget = newDsl.widgets[i];
    
    if (!oldWidget) {
      // 新增
      updates.push({ type: 'add', widgetId: `widget-${i}`, widget: newWidget });
    } else if (!newWidget) {
      // 删除
      updates.push({ type: 'remove', widgetId: `widget-${i}` });
    } else if (!deepEqual(oldWidget, newWidget)) {
      // 更新
      updates.push({ type: 'update', widgetId: `widget-${i}`, widget: newWidget });
    }
  }
  
  return updates;
}
```

---

## 8. 实现计划

### Phase 1: 核心编译器 (3 天)

- [ ] DSL TypeScript 类型定义
- [ ] DSL 验证器
- [ ] 基础组件模板（card, text, list, form）
- [ ] 布局编译器（single, split, grid）
- [ ] A2UI JSONL 输出

### Phase 2: 完整组件 (3 天)

- [ ] table 组件模板
- [ ] chart 组件模板
- [ ] status/progress 组件
- [ ] 嵌套组件支持
- [ ] Actions 编译

### Phase 3: 优化层 (2 天)

- [ ] 规则引擎
- [ ] 语义缓存
- [ ] 小模型分类
- [ ] 降级策略

### Phase 4: 集成 (2 天)

- [ ] LLM Prompt 调优
- [ ] ClawUI 集成测试
- [ ] 性能基准测试
- [ ] 文档

---

## 9. 附录

### A. 完整 DSL 示例

```json
{
  "layout": "split-7-3",
  "title": "销售仪表盘",
  "widgets": [
    {
      "type": "chart",
      "props": {
        "title": "月度趋势",
        "chartType": "line",
        "data": {
          "labels": ["1月", "2月", "3月", "4月", "5月", "6月"],
          "datasets": [
            {"name": "销售额", "values": [120000, 135000, 148000, 162000, 178000, 195000]},
            {"name": "目标", "values": [130000, 140000, 150000, 160000, 170000, 180000]}
          ]
        }
      }
    },
    {
      "type": "table",
      "props": {
        "title": "Top 销售",
        "columns": [
          {"key": "name", "label": "姓名"},
          {"key": "amount", "label": "金额", "align": "right"},
          {"key": "rate", "label": "达成率", "align": "right"}
        ],
        "rows": [
          {"name": "张三", "amount": "¥89,000", "rate": "112%"},
          {"name": "李四", "amount": "¥76,000", "rate": "95%"},
          {"name": "王五", "amount": "¥68,000", "rate": "85%"}
        ]
      }
    },
    {
      "type": "card",
      "props": {
        "title": "本月总览",
        "children": [
          {"type": "text", "props": {"content": "¥195,000", "variant": "h1"}},
          {"type": "text", "props": {"content": "较上月 +8.5%", "variant": "caption", "color": "success"}}
        ]
      }
    },
    {
      "type": "list",
      "props": {
        "title": "待办事项",
        "items": [
          {"id": "1", "title": "跟进大客户报价", "subtitle": "今天截止", "tags": ["紧急"]},
          {"id": "2", "title": "准备季度汇报", "subtitle": "本周五"},
          {"id": "3", "title": "新人培训", "subtitle": "下周一"}
        ]
      }
    }
  ],
  "actions": [
    {"id": "export", "label": "导出报表", "action": "export", "icon": "download"},
    {"id": "refresh", "label": "刷新", "action": "refresh", "style": "primary"}
  ]
}
```

### B. 对应 A2UI 输出（部分）

```jsonl
{"surfaceUpdate":{"surfaceId":"header","components":[{"id":"title","component":{"Text":{"text":"销售仪表盘","usageHint":"h2"}}}]}}
{"surfaceUpdate":{"surfaceId":"canvas","components":[{"id":"root","component":{"Row":{"children":{"explicitList":["left-col","right-col"]},"spacing":16}}},{"id":"left-col","component":{"Column":{"children":{"explicitList":["widget-0","widget-1"]},"flex":7}}},{"id":"right-col","component":{"Column":{"children":{"explicitList":["widget-2","widget-3"]},"flex":3}}},...]}}
{"beginRendering":{"surfaceId":"canvas","root":"root"}}
{"surfaceUpdate":{"surfaceId":"actions","components":[{"id":"export","component":{"Button":{"label":"导出报表","action":"export","icon":"download"}}},{"id":"refresh","component":{"Button":{"label":"刷新","action":"refresh","style":"primary"}}}]}}
```

---

*文档结束*

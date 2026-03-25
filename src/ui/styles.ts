/** ClawUI AgentOS 界面样式 */
export const CSS = `
* { margin: 0; padding: 0; box-sizing: border-box; }
body { font-family: system-ui, -apple-system, sans-serif; background: #0a0a0a; color: #e0e0e0; height: 100vh; display: flex; flex-direction: column; }

/* === App Shell === */
.app-header { padding: 12px 24px; border-bottom: 1px solid #1a1a1a; display: flex; align-items: center; justify-content: space-between; background: #0f0f0f; position: relative; }
.app-header .brand { display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 600; }
.app-header .conn { font-size: 11px; color: #4ade80; }
.app-header .conn.off { color: #f87171; }

/* === Progress Bar === */
.progress-line { position: absolute; bottom: 0; left: 0; height: 3px; background: #4ade80; width: 0; transition: width .3s ease, opacity .5s ease; opacity: 0; }
.progress-line.active { opacity: 1; }
.progress-line.done { width: 100% !important; }
.progress-line.fade { opacity: 0; }

.app-body { flex: 1; display: flex; overflow: hidden; }
.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; }

/* === Sidebar === */
.sidebar { width: 340px; border-left: 1px solid #1a1a1a; display: flex; flex-direction: column; background: #080808; transition: width .25s ease, opacity .25s ease; overflow: hidden; }
.sidebar.collapsed { width: 0; border-left: none; opacity: 0; }
.sidebar-toggle { position: absolute; right: 0; top: 50%; transform: translateY(-50%); width: 20px; height: 40px; background: #1a1a1a; border: 1px solid #333; border-right: none; border-radius: 6px 0 0 6px; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #666; font-size: 11px; z-index: 10; }
.sidebar-toggle:hover { background: #222; color: #e0e0e0; }
.sidebar-tab { display: flex; border-bottom: 1px solid #1a1a1a; }
.sidebar-tab button { flex: 1; padding: 8px; font-size: 11px; color: #666; background: none; border: none; cursor: pointer; text-transform: uppercase; letter-spacing: 1px; }
.sidebar-tab button.active { color: #e0e0e0; border-bottom: 2px solid #4f46e5; }
.copy-btn { font-size: 11px !important; color: #555 !important; cursor: pointer; margin-left: auto; padding: 4px 10px !important; border-radius: 4px; transition: .15s; }
.copy-btn:hover { color: #e0e0e0 !important; background: #222; }
.copy-btn.copied { color: #4ade80 !important; }
.sidebar-body { flex: 1; overflow-y: auto; padding: 12px; font: 12px/1.6 ui-monospace, monospace; color: #666; white-space: pre-wrap; word-break: break-all; }

/* === Sidebar Meta Panel === */
.sidebar-meta { padding: 12px; border-bottom: 1px solid #1a1a1a; font-size: 12px; color: #888; display: flex; flex-direction: column; gap: 6px; }
.sidebar-meta .meta-row { display: flex; justify-content: space-between; align-items: center; }
.sidebar-meta .meta-label { color: #555; }
.sidebar-meta .meta-value { color: #bbb; font-family: ui-monospace, monospace; }
.sidebar-meta .meta-value.highlight { color: #4ade80; }

/* === Frame Slots === */
.slot-header { padding: 14px 24px; border-bottom: 1px solid #1a1a1a; background: #0d0d0d; min-height: 52px; display: flex; align-items: center; justify-content: space-between; }
.slot-canvas { flex: 1; padding: 24px; overflow-y: auto; display: flex; flex-direction: column; align-items: center; }
.slot-canvas > .surface { width: 100%; max-width: 960px; }
.slot-actions { padding: 8px 24px; border-top: 1px solid #1a1a1a; background: #0d0d0d; display: flex; align-items: center; gap: 8px; min-height: 48px; }
.slot-actions:empty, .slot-actions.hidden { display: none; }
.slot-context { width: 280px; border-left: 1px solid #1a1a1a; padding: 14px; overflow-y: auto; background: #0a0a0a; }
.slot-context.hidden { display: none; }
.slot-context .ctx-title { font-size: 11px; color: #555; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 10px; }
.slot-context .ctx-item { padding: 8px 10px; border-radius: 6px; font-size: 13px; color: #999; cursor: pointer; margin-bottom: 4px; }
.slot-context .ctx-item:hover { background: #1a1a1a; color: #e0e0e0; }
.canvas-with-context { display: flex; flex: 1; overflow: hidden; }
.canvas-with-context .slot-canvas { flex: 1; }

/* === Home Screen === */
.home-screen { display: flex; flex-direction: column; align-items: center; flex: 1; padding: 40px 24px; gap: 28px; overflow-y: auto; }
.home-greeting { font-size: 22px; font-weight: 300; color: #888; }
.app-grid { display: grid; grid-template-columns: repeat(4, 80px); gap: 16px; justify-content: center; }
.app-tile { display: flex; flex-direction: column; align-items: center; gap: 6px; padding: 14px 8px; border-radius: 14px; cursor: pointer; transition: .15s; }
.app-tile:hover { background: #1a1a1a; transform: translateY(-2px); }
.app-tile:active { transform: scale(.95); }
.app-tile-icon { font-size: 32px; line-height: 1; }
.app-tile-label { font-size: 12px; color: #999; }
.recent-section { width: 100%; max-width: 400px; }
.recent-title { font-size: 12px; color: #555; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
.recent-row { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 8px; cursor: pointer; transition: .15s; }
.recent-row:hover { background: #1a1a1a; }
.recent-icon { font-size: 16px; flex-shrink: 0; }
.recent-label { flex: 1; font-size: 13px; color: #bbb; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.recent-time { font-size: 11px; color: #555; flex-shrink: 0; }
.home-input { width: 100%; max-width: 400px; display: flex; gap: 8px; }
.home-input input { flex: 1; padding: 12px 16px; border-radius: 12px; border: 1px solid #333; background: #111; color: #e0e0e0; font-size: 14px; outline: none; }
.home-input input:focus { border-color: #4f46e5; }
.home-input button { padding: 12px 18px; border-radius: 12px; border: none; background: #4f46e5; color: #fff; font-size: 14px; cursor: pointer; }
.home-input button:hover { background: #4338ca; }

/* === Done State === */
.done-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; gap: 20px; padding: 40px; }
.done-icon { font-size: 48px; }
.done-title { font-size: 20px; font-weight: 600; }
.done-detail { font-size: 14px; color: #888; text-align: center; line-height: 1.6; }
.done-suggestions { display: flex; flex-direction: column; gap: 6px; margin-top: 12px; }
.done-suggestion { padding: 10px 16px; border-radius: 8px; border: 1px solid #222; background: #111; color: #bbb; font-size: 13px; cursor: pointer; }
.done-suggestion:hover { border-color: #4f46e5; color: #e0e0e0; }

/* === Error State === */
.error-panel { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; gap: 16px; padding: 40px; }
.error-icon { font-size: 40px; }
.error-title { font-size: 18px; font-weight: 600; color: #f87171; }
.error-detail { font-size: 14px; color: #888; text-align: center; max-width: 400px; line-height: 1.6; }

/* === A2UI Components === */
.a2ui-column { display: flex; flex-direction: column; gap: 10px; }
.a2ui-row { display: flex; gap: 10px; align-items: center; }
.a2ui-text-h1 { font-size: 24px; font-weight: 700; }
.a2ui-text-h2 { font-size: 20px; font-weight: 600; }
.a2ui-text-h3 { font-size: 16px; font-weight: 600; }
.a2ui-text-body { font-size: 14px; line-height: 1.5; }
.a2ui-button { padding: 10px 20px; border-radius: 8px; border: 1px solid #333; background: #222; color: #fff; cursor: pointer; font-size: 14px; font-weight: 500; transition: .15s; }
.a2ui-button-primary { background: #4f46e5; border-color: #4f46e5; }
.a2ui-button-danger { background: #dc2626; border-color: #dc2626; }
.a2ui-button:hover { opacity: .85; }
.a2ui-textfield { display: flex; flex-direction: column; gap: 4px; }
.a2ui-textfield label { font-size: 13px; color: #999; }
.a2ui-textfield input { padding: 10px; border-radius: 8px; border: 1px solid #333; background: #111; color: #e0e0e0; font-size: 14px; }
.a2ui-card { background: #151515; border-radius: 10px; padding: 14px; border: 1px solid #222; }
.a2ui-card-title { font-size: 14px; font-weight: 600; margin-bottom: 6px; }
.a2ui-toggle { display: flex; align-items: center; gap: 8px; }
.a2ui-toggle-switch { width: 36px; height: 20px; border-radius: 10px; background: #333; position: relative; cursor: pointer; }
.a2ui-toggle-switch::after { content: ''; width: 16px; height: 16px; border-radius: 50%; background: #888; position: absolute; top: 2px; left: 2px; transition: .2s; }
.a2ui-toggle-switch.on { background: #4f46e5; }
.a2ui-toggle-switch.on::after { left: 18px; background: #fff; }
.a2ui-divider { border: none; border-top: 1px solid #222; margin: 4px 0; }
.a2ui-datetime { display: flex; flex-direction: column; gap: 4px; }
.a2ui-datetime label { font-size: 13px; color: #999; }
.a2ui-datetime input { padding: 10px; border-radius: 8px; border: 1px solid #333; background: #111; color: #e0e0e0; font-size: 14px; }
.a2ui-image { max-width: 100%; border-radius: 8px; }
.a2ui-progress { width: 100%; height: 8px; border-radius: 4px; background: #222; overflow: hidden; }
.a2ui-progress-bar { height: 100%; background: #4f46e5; border-radius: 4px; transition: width .4s ease; }
.a2ui-progress-label { font-size: 12px; color: #888; margin-top: 4px; }
.a2ui-status { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.a2ui-status-dot { width: 8px; height: 8px; border-radius: 50%; }
.a2ui-status-dot.thinking, .a2ui-status-dot.working { background: #facc15; animation: pulse 1.2s infinite; }
.a2ui-status-dot.waiting { background: #4f46e5; }
.a2ui-status-dot.done { background: #4ade80; }
.a2ui-status-dot.error { background: #f87171; }
@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
.a2ui-spacer { flex-shrink: 0; }
.a2ui-accordion-toggle { width: 100%; padding: 12px 16px; border-radius: 8px; border: 1px solid #222; background: #111; color: #e0e0e0; cursor: pointer; font-size: 14px; font-weight: 500; text-align: left; }
.a2ui-accordion-toggle:hover { background: #1a1a1a; }
.a2ui-accordion-body { padding: 0 16px; max-height: 0; overflow: hidden; transition: max-height .25s ease, padding .25s ease; }
.a2ui-accordion-body.open { max-height: 500px; padding: 10px 16px; }

/* === Agent Selection === */
.agents-screen { display: flex; flex-direction: column; align-items: center; flex: 1; padding: 40px; gap: 16px; justify-content: center; }
.agents-title { font-size: 22px; font-weight: 600; }
.agents-subtitle { font-size: 13px; color: #888; margin-bottom: 8px; }
.agents-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; width: 100%; max-width: 600px; }
.agent-card { padding: 20px; border-radius: 12px; border: 1px solid #222; background: #111; cursor: pointer; transition: .15s; }
.agent-card:hover { border-color: #4f46e5; background: #1a1a1a; transform: translateY(-2px); }
.agent-name { font-size: 16px; font-weight: 600; margin-bottom: 6px; }
.agent-desc { font-size: 13px; color: #888; line-height: 1.4; }

/* === Idle Settings Link === */
.idle-settings { margin-top: 20px; }
.idle-settings span { font-size: 13px; color: #555; cursor: pointer; }
.idle-settings span:hover { color: #e0e0e0; }

/* === Agent Badge === */
.agent-badge { display: flex; align-items: center; gap: 6px; font-size: 13px; color: #bbb; background: #181818; padding: 5px 12px; border-radius: 8px; border: 1px solid #222; white-space: nowrap; }
.agent-badge-dot { width: 7px; height: 7px; border-radius: 50%; background: #4ade80; flex-shrink: 0; }
.agent-badge-switch { cursor: pointer; color: #666; margin-left: 2px; }
.agent-badge-switch:hover { color: #e0e0e0; }

/* === Loading === */
.loading-screen { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; gap: 20px; }
.loading-spinner { width: 40px; height: 40px; border: 3px solid #222; border-top-color: #4f46e5; border-radius: 50%; animation: spin 0.8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.loading-text { font-size: 14px; color: #888; }

/* === Nav Buttons === */
.nav-buttons { display: flex; gap: 8px; margin-left: auto; }

/* === Bottom Input (inline in slot-actions) === */
.bottom-input { display: flex; gap: 8px; flex: 1; min-width: 0; }
.bottom-input input { flex: 1; padding: 8px 12px; border-radius: 8px; border: 1px solid #333; background: #111; color: #e0e0e0; font-size: 13px; outline: none; min-width: 0; }
.bottom-input input:focus { border-color: #4f46e5; }
.bottom-input button { padding: 8px 14px; border-radius: 8px; border: none; background: #4f46e5; color: #fff; font-size: 13px; cursor: pointer; white-space: nowrap; }
.bottom-input button:hover { background: #4338ca; }

/* === Toast === */
.clawui-toast { position: fixed; top: 16px; right: 16px; padding: 12px 20px; border-radius: 8px; font-size: 14px; color: #fff; z-index: 100; animation: toast-in .3s ease; }
.clawui-toast.success { background: #16a34a; }
.clawui-toast.info { background: #2563eb; }
.clawui-toast.warning { background: #d97706; }
.clawui-toast.error { background: #dc2626; }
@keyframes toast-in { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

.action-log { margin-top: 8px; font: 12px ui-monospace, monospace; color: #4ade80; }

/* === Markdown content === */
.a2ui-md { font-size: 14px; line-height: 1.7; color: #d0d0d0; }
.a2ui-md strong { color: #fff; }
.a2ui-md br { display: block; margin: 2px 0; }
.a2ui-code { background: #111; border: 1px solid #222; border-radius: 8px; padding: 14px 16px; font: 13px/1.6 ui-monospace, monospace; color: #d0d0d0; overflow-x: auto; white-space: pre; margin: 8px 0; }
.a2ui-inline-code { background: #1a1a1a; padding: 2px 6px; border-radius: 4px; font: 13px ui-monospace, monospace; color: #e0e0e0; }
.a2ui-list-item { padding: 2px 0; }
.a2ui-table-row { font: 13px/1.6 ui-monospace, monospace; color: #bbb; padding: 2px 0; border-bottom: 1px solid #1a1a1a; }
.a2ui-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.a2ui-table th { text-align: left; padding: 8px 10px; color: #888; border-bottom: 1px solid #333; font-weight: 500; }
.a2ui-table td { padding: 8px 10px; border-bottom: 1px solid #1a1a1a; color: #d0d0d0; }
.a2ui-table tr:hover td { background: #151515; }

/* === Skeleton === */
.skeleton-line { background: linear-gradient(90deg, #1a1a1a 25%, #252525 50%, #1a1a1a 75%); background-size: 200% 100%; animation: shimmer 1.5s infinite; border-radius: 6px; height: 18px; margin: 6px 0; color: transparent !important; }
.skeleton-header { height: 22px; opacity: .7; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* === Mobile === */
@media (max-width: 768px) {
  .app-body { flex-direction: column; }
  .sidebar { width: 100%; max-height: 200px; border-left: none; border-top: 1px solid #1a1a1a; }
  .sidebar.collapsed { max-height: 0; }
  .sidebar-toggle { display: none; }
  .slot-canvas { padding: 12px; }
  .slot-canvas > .surface { max-width: 100%; }
  .slot-header { padding: 10px 12px; }
  .slot-actions { padding: 8px 12px; flex-wrap: wrap; }
  .slot-context { width: 100%; border-left: none; border-top: 1px solid #1a1a1a; max-height: 150px; }
  .canvas-with-context { flex-direction: column; }
  .nav-buttons { display: none; }
  .app-grid { grid-template-columns: repeat(4, 70px); gap: 12px; }
  .home-input { max-width: 100%; }
  .home-screen { padding: 24px 16px; gap: 20px; }
  .recent-section { max-width: 100%; }
}
`;

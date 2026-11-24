# CST Admin Panel (P3 — Web Administration)

Community Service Tracking 的 Web 管理后台：工单池、派单与状态流转、统计看板。

技术栈：React 18 + TypeScript + Vite + ECharts + React Router。无 UI 框架依赖，样式为
`src/styles.css` 中的轻量设计令牌，与居民端共用同一套状态码/分类码约定。

## 运行

```bash
cd admin
npm install
npm run dev        # http://localhost:5173
```

生产构建：`npm run build`（输出 `dist/`，可部署到 Apache 任意目录）。

## 登录

默认 mock 账号：`admin@uts.edu.my` / `password123`（仅接受 `role = admin` 的账号）。

## Mock 与真实 API 切换

`admin/src/api/index.ts` 是唯一切换点：

| 文件 | 作用 |
|---|---|
| `api/mock/mockApi.ts` | 本地 mock 层，种子 14 张多状态工单存 localStorage，所有动作真实生效 |
| `api/realApi.ts` | 对接 P1 的 PHP REST API（`/api/admin/*`） |
| `api/config.ts` | `VITE_API_BASE_URL` + `VITE_USE_MOCK` 开关 |

切换只需在 `admin/.env` 里设置（参考 `.env.example`）：

```
VITE_API_BASE_URL=http://localhost/api
VITE_USE_MOCK=false
```

## 功能对照（评分项）

- 登录鉴权（Bearer token，401 自动跳回登录）
- 工单池：按状态/分类/优先级筛选 + 关键字搜索 + 三种排序（优先级/时间/截止）
- 详情页：居民信息、坐标外链地图、现场照片、状态履历时间轴
- 四个动作：**受理 → 派单（选人员 + SLA 自动算截止时间 + 优先级）→ 回填完工备注与照片（≤3 张）→ 不受理（必填原因）**
- 统计看板：总量/待处理/处理中/完成/逾期 KPI，14 天上报趋势、分类占比饼图、分类平均处理时长柱状图、居民满意度
- 每个状态动作都写入 `ticket_status_logs`，与居民端时间轴同源

## 给 P1 的接口契约

`admin-api-spec.md`（本目录）定义了管理端需要的全部 `/api/admin/*` 接口。
P1 实现后按上述 .env 切换即可，前端零改动。

## 目录结构

```
admin/
├─ index.html / vite.config.ts / tsconfig.json / package.json
├─ .env.example          # API 地址与 mock 开关
├─ admin-api-spec.md     # 管理端 API 契约（交给 P1）
└─ src/
   ├─ main.tsx / App.tsx        # 路由与鉴权守卫
   ├─ auth.tsx                  # 登录态 context + localStorage 会话
   ├─ styles.css                # 设计令牌与全局样式
   ├─ models.ts                 # 与六表 schema 对应的领域类型
   ├─ api/                      # config / realApi / mock / 统一入口
   ├─ components/              # Chart / Modal / StatusBadge / PriorityTag
   ├─ layouts/AdminLayout.tsx   # 侧边导航外壳
   └─ pages/                    # Login / Tickets / TicketDetail / Statistics
```

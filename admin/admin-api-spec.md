# Admin Panel API Contract — Community Service Tracking

P3 → P1 接口契约。管理端 Web Admin 全部功能依赖下列接口；P1 实现完成后，
前端只需设置 `VITE_API_BASE_URL` 并把 `VITE_USE_MOCK=false`，代码零改动。

## 全局约定（与居民端规范一致）

- **Base URL**: `http://<server-host>/api`
- **Auth Header**（除 `/admin/login` 外全部必带）: `Authorization: Bearer <token>`
- **角色**：本面板仅接受 `role = 'admin'` 的账号；登录接口需校验并在返回的
  `role` 字段中标明，非 admin 返回 `403`。
- **Content-Type**:
  - 常规请求 `application/json`
  - `PATCH /admin/tickets/{id}/complete` 为 `multipart/form-data`（完工照片）
- **标准 JSON 包装**（与居民端相同）：

```json
// Success
{ "success": true, "message": "Operation successful.", "data": {} }
// Error
{ "success": false, "message": "Human-readable reason." }
```

- HTTP 状态码：`400` 校验失败 / `401` token 无效 / `403` 非管理员 / `404` 工单不存在 / `409` 状态流转不合法。
- 时间格式：`YYYY-MM-DD HH:MM:SS`。所有列表按 `created_at DESC`（工单池由前端再按优先级排序，后端可不强序）。

## 接口清单

| # | Method | Endpoint | Auth | Content-Type | 用途 |
|---|---|---|---|---|---|
| 1 | `POST` | `/admin/login` | No | JSON | 管理员登录 |
| 2 | `GET` | `/admin/staff` | Yes | JSON | 维修人员列表（派单下拉） |
| 3 | `GET` | `/admin/categories` | Yes | JSON | 分类列表（含 SLA 小时） |
| 4 | `GET` | `/admin/tickets` | Yes | JSON | 工单池（支持筛选参数） |
| 5 | `GET` | `/admin/tickets/{id}` | Yes | JSON | 单张工单 + 履历 + 评价 |
| 6 | `PATCH` | `/admin/tickets/{id}/accept` | Yes | JSON | 受理 |
| 7 | `PATCH` | `/admin/tickets/{id}/assign` | Yes | JSON | 派单 / 改派 |
| 8 | `PATCH` | `/admin/tickets/{id}/complete` | Yes | Multipart | 回填完工 |
| 9 | `PATCH` | `/admin/tickets/{id}/reject` | Yes | JSON | 不受理 |
| 10 | `GET` | `/admin/stats` | Yes | JSON | 统计看板数据 |

与居民端规范的说明一样：如果 PHP 侧偏好 `POST /admin/tickets/accept.php` 这类路径，
可以自行调整，只要 JSON 字段不变。

---

## 1. `POST /admin/login`

Request / Response 与居民端 `POST /login` 完全一致（同一张 users 表、同一个签发逻辑）。
唯一差别是后端须拒绝 `role != 'admin'`（`403`，message 示例：
`"This account is not an administrator."`）。

## 2. `GET /admin/staff`

- Response (`data`)：`role = 'staff'` 的用户数组

```json
[
  { "id": 10, "name": "Technician Lim", "email": "lim.wk@uts.edu.my", "phone": "+60165550001", "role": "staff" }
]
```

## 3. `GET /admin/categories`

- Response (`data`)：

```json
[
  { "id": 1, "name": "Lighting", "code": "lighting", "sla_hours": 48 },
  { "id": 2, "name": "Garbage Collection", "code": "garbage", "sla_hours": 24 }
]
```

## 4. `GET /admin/tickets`

- Query 参数（均可选）：`status`、`category_id`、`priority`、`search`
  （search 匹配 ticket_no / title / location_desc / resident_name，后端做宽松匹配即可）。
- **与居民端的区别：返回全部居民的工单**（不限 resident_id），字段在居民端 Ticket 对象上
  增加 `resident_name`、`assignee_name` 两个联表字段：

```json
[
  {
    "id": 101,
    "ticket_no": "CS-20261121-0001",
    "resident_id": 2,
    "resident_name": "Mei Ling",
    "category_id": 1,
    "category_code": "lighting",
    "category_name": "Lighting",
    "title": "Corridor light out for three nights",
    "description": "The ceiling light near the staircase does not turn on.",
    "location_desc": "Block A, Level 3, end of corridor",
    "lat": 3.1414,
    "lng": 101.6912,
    "photo_urls": ["http://your-host/uploads/tickets/101_1.jpg"],
    "status": "pending",
    "priority": "normal",
    "assignee_id": null,
    "assignee_name": null,
    "due_at": null,
    "accepted_at": null,
    "completed_at": null,
    "reject_reason": null,
    "cancelled_reason": null,
    "cancelled_at": null,
    "created_at": "2026-11-21 08:15:00",
    "updated_at": "2026-11-21 08:15:00"
  }
]
```

## 5. `GET /admin/tickets/{id}`

与居民端 `GET /tickets/{id}` 的 Ticket bundle 结构一致（`ticket` + `logs` + `rating`），
`ticket` 里同样带上 `resident_name`、`assignee_name`。

## 6. `PATCH /admin/tickets/{id}/accept`

- **业务规则**：仅 `status = pending` 可受理；否则 `409`。
- Request: 空对象 `{}` 即可（可选 `{ "note": "..." }`）。
- 后端动作：`status → accepted`、写 `accepted_at`、插一条
  `pending → accepted` 履历（operator_id = 当前管理员）。
- Response (`data`)：Ticket bundle。

## 7. `PATCH /admin/tickets/{id}/assign`

- **业务规则**：`status = accepted` 或 `in_progress` 可派单/改派；否则 `409`。
  `assignee_id` 必须是存在的 `role = staff` 用户。
- Request:

```json
{
  "assignee_id": 10,
  "priority": "urgent",
  "due_at": "2026-11-26 22:26:00",
  "note": "Bring LED panel and check wiring."
}
```

- 后端动作：`status → in_progress`、更新 assignee_id / priority / due_at、
  插一条 `accepted → in_progress`（首次派单）或 `in_progress → in_progress`（改派）
  履历，note 记录派给谁、优先级与截止时间。
- Response (`data`)：Ticket bundle。

## 8. `PATCH /admin/tickets/{id}/complete`

- **业务规则**：仅 `status = in_progress` 可完工；否则 `409`。照片最多 3 张。
- Multipart 字段：`note`（string，可选）、`photos[]`（file array，可选，≤3）。
- 后端动作：`status → completed`、写 `completed_at`、照片存
  `uploads/completions/` 并回传完整 URL、插一条 `in_progress → completed`
  履历（photo_urls 写入该履历行）。
- Response (`data`)：Ticket bundle。

## 9. `PATCH /admin/tickets/{id}/reject`

- **业务规则**：仅 `pending` 或 `accepted` 可不受理；`reason` 必填；否则 `409/400`。
- Request: `{ "reason": "Outside community jurisdiction — forwarded to municipal council." }`
- 后端动作：`status → rejected`、写 `reject_reason`、插履历。
- Response (`data`)：Ticket bundle。

## 10. `GET /admin/stats`

所有数字后端现算（与居民端“状态与统计同源”的约定一致，不建汇总表）：

```json
{
  "trend": [
    { "date": "2026-11-11", "count": 1 },
    { "date": "2026-11-12", "count": 3 }
  ],
  "categories": [
    { "code": "lighting", "name": "Lighting", "count": 4 },
    { "code": "garbage", "name": "Garbage Collection", "count": 2 },
    { "code": "facility", "name": "Public Facility", "count": 3 },
    { "code": "noise", "name": "Noise Disturbance", "count": 2 }
  ],
  "avg_hours": [
    { "code": "lighting", "name": "Lighting", "avg_hours": 14.5, "completed": 2 },
    { "code": "garbage", "name": "Garbage Collection", "avg_hours": 29.0, "completed": 1 },
    { "code": "facility", "name": "Public Facility", "avg_hours": null, "completed": 0 },
    { "code": "noise", "name": "Noise Disturbance", "avg_hours": null, "completed": 0 }
  ],
  "summary": {
    "total": 14,
    "pending": 4,
    "accepted": 2,
    "in_progress": 2,
    "completed": 4,
    "rejected": 1,
    "cancelled": 1,
    "avg_hours_all": 17.0,
    "avg_stars": 4.5,
    "overdue": 2
  }
}
```

计算口径：

- `trend`：最近 14 天每天的建单数（`created_at` 按日分组），14 行固定返回（可为 0）。
- `categories`：全量工单按 `category_id` 分组计数。
- `avg_hours`：`completed_at - accepted_at` 的平均小时数，按分类；无完工工单时为 `null`。
- `avg_hours_all`：所有 `completed` 工单的平均处理小时。
- `avg_stars`：ratings 表全部 star 的平均（无评价为 `null`）。
- `overdue`：`status = in_progress` 且 `due_at < NOW()` 的张数。

## 状态机（与全局约定一致）

```
pending ──accept(admin)──→ accepted ──assign(admin)──→ in_progress ──complete(admin)──→ completed
   │                          │
   └────reject(admin)────→ rejected（pending 或 accepted 均可）
resident: pending/accepted ──cancel──→ cancelled（居民端行为，见居民端规范）
```

每次状态变更必须同事务写入 `ticket_status_logs` 一行 —— 这是两端时间轴与统计口径的共同来源。
派单时 `due_at` 建议由管理端提交（面板已按分类 `sla_hours` 预填），后端亦可做兜底校验。

## Shared Admin/Staff workflow additions (P3/P1 contract)

- Admin Staff Zones supports `PATCH /admin/staff/{id}` for `name`, `email`, `phone`, `zones`, and `professions`, and `DELETE /admin/staff/{id}`. Deleting a staff account must clear/requeue that person's active assignments before removal.
- `PATCH /admin/tickets/{id}/assign` must accept an unassigned `pending` ticket and selected `assignee_id`, then set it to `accepted` so the staff member can start processing. It must no longer reject pending tickets from the Unassigned pool.

The migration in `backend_workflow_migration.sql` is the source for the new persistent fields and task tables. Keep one ticket service and extend its transactions; do not create separate ticket assignment implementations.

### Duty state and routing

- `GET /admin/staff` returns `duty_status` (`on_duty` / `off_duty`) with each staff record.
- `PATCH /admin/staff/{id}/duty` accepts `{ "duty_status": "on_duty" | "off_duty" }`. Staff may update their own status; admins may update staff status. Admin duty state is also used by the Others fallback.
- Route eligible tickets by category job tag, service zone, and `duty_status='on_duty'`. Create an offer for every matching staff member. Do not set `assignee_id` until one staff member accepts.
- `PATCH /admin/tickets/{id}/accept` supports Staff and Admin. For a staff claim, atomically set the assignee and accepted status only when the ticket remains pending and unclaimed. Return `409` when another worker won.
- If no eligible on-duty worker matches, leave the ticket unassigned for Admin. For Others, publish to the public staff pool only if no Admin is On Duty.

### Work tasks, relay, and support

- Staff acceptance moves the ticket to `accepted`; `PATCH /admin/tickets/{id}/start` moves it to `in_progress`.
- `PATCH /admin/tickets/{id}/complete` accepts optional `relay_tasks` as a JSON array in the multipart form, plus 1–3 after-repair photos. Insert ordered work-task nodes. Activate only the next node after its prerequisite completes.
- `POST /admin/tickets/{id}/support` accepts `{ "helper_id": number, "reason": string }`. In one transaction, block the current task, create and assign the prerequisite task to an on-duty colleague, link the blocked task to it, and increment `handoff_count`.
- When every work task is complete, set the parent ticket to `completed`, set `acceptance_status='awaiting_acceptance'`, and set `acceptance_due_at` to 48 hours later.
- The Resident team owns confirmation, rating, and return-for-rework endpoints. Those actions must update `ticket_acceptance_events`; a scheduled backend job auto-accepts tickets past their deadline.
- When `handoff_count > 3`, set `admin_attention=1` and include the reason in the ticket response so the Admin panel can highlight it.

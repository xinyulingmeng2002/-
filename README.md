# 多智能体协作台

Phase 1A 已完成的独立仓库底座，包含：

- `apps/server`：Fastify + Socket.IO 服务端
- `apps/web`：React + Vite 最小协作前端
- `packages/protocol`：共享协议与 Zod schema

## 安装

```bash
npm install
```

## 本地开发

分别启动服务端和前端：

```bash
npm run dev:server
npm run dev:web
```

默认开发链路：

- 服务端：`http://127.0.0.1:3000`
- 前端：`http://127.0.0.1:5173`

Vite 已代理 `/api` 与 `/socket.io` 到本地服务端，直接打开前端即可走真实 HTTP / realtime 链路。

## 测试与检查

整仓：

```bash
npm test
npm run typecheck
```

按 workspace：

```bash
npm --workspace @ma/server test
npm --workspace @ma/web test
npm --workspace @ma/protocol test
npm --workspace @ma/web run build
```

说明：`apps/server/test/socket-room.test.ts` 仍为可选集成测试，当前环境下默认跳过；需要时用 `RUN_SOCKET_IT=1` 单独启用。

## 数据目录

运行时数据默认写入仓库根下的 `data/`，并已加入 `.gitignore`：

- `data/db/`：文件型快照存储
- `data/logs/`：房间事件日志 JSONL
- `data/uploads/`：上传文件落盘目录

测试使用临时目录，不会污染仓库内运行时数据。

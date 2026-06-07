# CipherTalk_self 开发计划

## 当前任务：修复朋友圈图片解密

**问题**：朋友圈导出的图片全部损坏，无法显示。

**技术背景**：朋友圈图片和普通聊天图片使用完全不同的解密体系：
- 普通聊天图片：本地 DAT 文件，XOR / AES-128-ECB 解密（`imageDecryptService.ts`）
- 朋友圈图片：CDN 网络下载，ISAAC64 流密码 XOR 解密（`snsService.ts`）

**关键文件**：
- `electron/services/snsService.ts` — 朋友圈图片下载 + ISAAC64 解密
- `electron/services/wasmService.ts` — WASM 版 ISAAC64 密钥流生成
- `electron/services/isaac64.ts` — 纯 TS 版 ISAAC64
- `electron/main/ipc/snsHandlers.ts` — IPC 入口（`sns:saveMediaToDir`）
- `src/pages/MomentsWindow.tsx` — 前端导出逻辑

**排查方向**：
1. ISAAC64 密钥流生成是否正确（WASM vs TS fallback 的 alignment + reverse 逻辑）
2. `key` 参数是否从 XML/URL 正确传递到解密函数
3. CDN URL 是否已过期（token 时效性）
4. 解密后文件头验证（JPEG/PNG/GIF/WebP magic bytes）
5. 导出时 `saveMediaToDir` 是否正确写入解密后的数据

**验证方法**：
- 导出朋友圈，检查 `media/` 目录下的图片文件头是否为有效图片格式（JPEG: `FF D8 FF`，PNG: `89 50 4E 47`）
- 在 DevTools Console 中查看 `[SnsService]` 开头的日志

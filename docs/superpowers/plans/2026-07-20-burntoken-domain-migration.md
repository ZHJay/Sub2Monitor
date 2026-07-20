# burntoken.org 域名迁移实现计划

> **面向 AI 代理的工作者：** 在当前会话内逐项执行并验证；步骤使用复选框跟踪。

**目标：** 将主站、CPA、Kiro、Sub2Monitor、Outlook 从 `api4kimi8.org` 域迁移到 `burntoken.org` 域，并让已停用的 KiroGo 明确返回 HTTP 410。

**架构：** 两台源站保留旧域名 vhost 以兼容现有客户端，新域名使用独立 Nginx vhost 和 Let's Encrypt 证书。Sub2Monitor 的固定 SSO authority/origin 切换到 `burntoken.org`，旧 Monitor 域完成切换后重定向到新域。所有应用仍通过既有 loopback 端口提供服务，不重建无关容器。

**技术栈：** Nginx、Certbot、Docker Compose、Go、Vue 3、Vitest、Cloudflare DNS/CDN。

---

## 文件结构

- 修改 `backend/internal/l3_diplomacy/sso_handler_test.go`：定义新 API/Monitor origin 的 SSO Bridge 契约。
- 修改 `backend/internal/l3_diplomacy/sso_handler.go`：应用新固定 origin 与 Host 校验。
- 修改 `backend/internal/l1_blocks/sub2api_identity_gateway_test.go`：定义新 authority URL。
- 修改 `backend/internal/l1_blocks/sub2api_identity_gateway.go`：调用新主站身份接口。
- 修改 `frontend/src/auth/sub2apiSsoBridge.test.ts`：定义新 top-level Bridge URL。
- 修改 `frontend/src/auth/sub2apiSsoBridge.ts`：使用新主站 origin。
- 修改 `frontend/src/App.vue`：登录链接切换到新主站。
- 修改 `docker-compose.yml`：容器内 host-gateway 名称切换到新主站。
- 创建远端 `/etc/nginx/sites-available/{burntoken.org,cpa.burntoken.org,kiro.burntoken.org,monitor.burntoken.org,kirogo.burntoken.org}`：大站新域路由。
- 创建远端 `/etc/nginx/sites-available/outlook.burntoken.org`：小站 Outlook 新域路由。

## 任务 1：建立可回滚基线

- [ ] 记录目标容器 ID、镜像、StartedAt、health、Nginx 配置 checksum。
- [ ] 将两台服务器的 Nginx 配置、证书元数据和相关 Compose 配置备份到 include 目录之外。
- [ ] 验证备份文件存在且 SHA-256 清单可读取。

## 任务 2：Sub2Monitor SSO 域名切换（TDD）

- [ ] 先将 Go/Vitest 测试期望切换为 `burntoken.org`，运行定向测试并确认因旧实现而失败。
- [ ] 最小修改固定 API origin、Monitor origin、Bridge Host、identity authority、登录链接与 host-gateway。
- [ ] 运行 Go 全量测试、`go vet`、Go build、Vitest 全量测试和前端 build。
- [ ] 构建 ARM64 runtime artifact，并核对 binary/dist 与待部署产物 SHA-256。

## 任务 3：Nginx 与 TLS 切换

- [ ] 先安装新域 HTTP ACME vhost，运行 `nginx -t` 后 reload。
- [ ] 大站签发包含主域、CPA、Kiro、Monitor、KiroGo 的 SAN 证书；小站签发 Outlook 证书。
- [ ] 安装最终 HTTPS vhost；KiroGo 在 HTTP/HTTPS 均返回 410。
- [ ] 运行 `nginx -t`，reload 后用 `curl --resolve` 验证源站路由不再落入默认站点。

## 任务 4：应用配置与 Monitor 发布

- [ ] 备份 Sub2API 数据库中包含旧域名的设置，并只更新确认的 URL 设置为新主域。
- [ ] 部署已测试的 Sub2Monitor ARM64 runtime artifact，仅 recreate `sub2monitor`。
- [ ] 等待 health 通过，再将旧 Monitor vhost 重定向到新 Monitor。
- [ ] 保持 sub2api、Postgres、Redis、Kiro、CPA、Outlook 容器 ID/StartedAt 不变。

## 任务 5：端到端验收

- [ ] 新主站首页和关键 API 正常；公开 base URL 已显示新域名。
- [ ] CPA management 页面、Kiro admin/API、Monitor health/静态资源、Outlook healthz 均命中正确上游。
- [ ] KiroGo 返回 410，不再显示 WasteToken。
- [ ] Monitor 未登录 metrics 返回 401/403；Bridge CSP、固定 origin、Host 校验均为新域名。
- [ ] 检查证书 SAN、Certbot renewal dry-run、Nginx 日志与容器健康。
- [ ] 复核旧域名兼容行为，并输出可执行回滚路径。

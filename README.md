# SkillTree · 第一版

个人技能图谱平台。包含注册登录、公共 Skill Hub、分类和别名搜索、个人技能状态、可拖拽的有向无环图、私有技能与社区投稿审核。

开发者：**宇崎崎andGPT** · 联系方式：[yuqigf@qq.com](mailto:yuqigf@qq.com) · 开源协议：[MIT](LICENSE)

## 技术栈

- 前端：React 19、TypeScript、Vite、React Flow、Axios
- 后端：Java 21、Spring Boot 3.5、Spring JDBC
- 本地数据库：MySQL 8
- 轻量服务器数据库：SQLite（使用 `sqlite` profile 切换）

## 本地启动

准备 Java 21、Maven、Node.js 20.19+、MySQL 8。先创建数据库：

```sql
CREATE DATABASE IF NOT EXISTS skilltree CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

在第一个终端启动后端：

```powershell
cd backend
$env:DB_USER='root'
$env:DB_PASSWORD='<你的本地 MySQL 密码>'
mvn -gs maven-settings.xml -s maven-settings.xml spring-boot:run
```

在第二个终端启动前端：

```powershell
cd frontend
npm install
npm run dev
```

打开 <http://127.0.0.1:5173>。Vite 把 `/api` 代理到本地 `8080` 端口。启动时会增量导入 `backend/src/main/resources/extended-skills.txt` 中的技能，按规范化名称去重，不会清空用户数据。数据会一直保存在 MySQL 的 `skilltree` 库里。

`backend/maven-settings.xml` 仅用于绕过本机 Maven 全局配置中无法访问的旧内网仓库；它指向 Maven Central。其他环境可以直接使用普通 Maven 命令。

## SQLite 服务器模式

同一套后端接口可切换到 SQLite。先创建 `backend/data` 目录，再在 `backend` 目录执行：

```powershell
New-Item -ItemType Directory -Force data
$env:SPRING_PROFILES_ACTIVE='sqlite'
java -jar target/skilltree-backend-0.1.0.jar
```

默认数据库文件是 `backend/data/skilltree.db`；可通过 `DB_URL` 改为 `jdbc:sqlite:/绝对路径/skilltree.db`。请定期备份数据库文件。首次启动会创建同样的表及内置技能。

后端默认只监听 `127.0.0.1`。服务器若经 Nginx 反向代理，可保持此默认值；如需容器内对外监听，设置 `HOST=0.0.0.0`。

## 当前服务器的 HTTPS

`deploy/nginx-skilltree.conf` 使用 Let's Encrypt 证书，把内部 `443` 端口反向代理到应用的 `5200` 端口；NAT 将外部 `54432` 转发至内部 `443`。因此 HTTPS 地址必须写明端口：`https://yuqiqi.love:54432/`。外部 `21573` 转内部 `80`，Nginx 会将该入口重定向到 HTTPS 高端口。

由于公网标准 `80`/`443` 端口不可用，证书通过 DNS TXT 验证签发。当前证书有效期至 2026-12-27，**Certbot 手动 DNS 验证不能自动续期**；到期前需重新发起 DNS 验证并更新 TXT 记录。服务器目前无法直接连接 Let's Encrypt ACME 接口，签发时曾通过临时 SSH 反向转发本机网络；转发已在签发后撤销。

服务器内部 HTTPS 和公网 IP 高端口转发已验证。域名的 HTTP 请求曾收到服务商 `ADM/2.1.1` 的 403 页面，域名 TLS 握手被重置；需要服务商解除域名访问限制后，域名 HTTPS 才能从公网正常使用。

## 创建技能与社区发布

新建技能会立即加入创建者的“我的技能”，可直接记录学习进度和加入图谱。默认仅自己可见。选择发布到 Skill Hub 时，系统会检查名称、说明、联系方式和近似重复项；符合规则的投稿自动公开，需要核对的投稿进入 `PENDING`，但创建者仍可使用。管理员可在“审核管理”处理待审核投稿。

启动后端前设置 `ADMIN_EMAIL` 和至少 8 位的 `ADMIN_PASSWORD`，首次启动时会创建管理员账号。管理员可以使用邮箱或用户名登录，也可以通过 `/api/auth/profile` 和 `/api/auth/password` 修改用户名和密码。请勿把实际管理员密码写入仓库。

## API 概览

- `/api/auth/register`、`/api/auth/login`：注册和登录
- `/api/categories`、`/api/skills`、`/api/skills/{id}`：分类、搜索和详情
- `/api/me/skills`：个人技能及学习状态
- `/api/trees`、`/api/trees/{id}/nodes`、`/api/trees/{id}/edges`：图谱、节点和连线
- `/api/skills/submissions`、`/api/admin/submissions`：技能投稿与审核

除公共查询和注册登录外，请求需携带 `Authorization: Bearer <token>`。服务端只保存令牌的 SHA-256 摘要，密码使用 BCrypt。

## 当前范围

第一版限制技能图谱为登录者本人可见，防止尚未完成公开资料页时泄漏私人技能。搜索使用数据库关键词及别名匹配，技能提交前做重名检查。暂未加入文件上传、社交功能或 AI 推荐。

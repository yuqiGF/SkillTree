# SkillTree · 第一版

个人技能图谱平台。包含注册登录、公共 Skill Hub、分类和别名搜索、个人技能状态、可拖拽的有向无环图、私有技能与社区投稿审核。
技能搜索先显示上层技能，可逐级展开子技能；添加子技能时会一并加入上级技能。“我的技能”按父子层级展示每项学习进度。图谱中提供从下向上生长的个人总体树与各分类树，随“我的技能”自动更新；树卡片可选择显示或隐藏，节点可展开或收起分支。另可创建自由布局的自定义图谱。
当前测试服务地址：http://103.39.64.76:57144/

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

打开 <http://127.0.0.1:5173>。Vite 把 `/api` 代理到本地 `8080` 端口。启动时会增量导入 `backend/src/main/resources/extended-skills.txt` 中的技能，并按 `subskill-templates.txt`、`curated-subskills.txt` 为官方技能建立细分能力。导入按规范化名称和父子关系去重，不会清空用户数据。数据会一直保存在 MySQL 的 `skilltree` 库里。

图谱页的“管理显示”会把选择按账号保存在当前浏览器；隐藏图谱不会删除其中的技能或学习记录。

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


## 创建技能与社区发布

新建技能会立即加入创建者的“我的技能”，可直接记录学习进度和加入图谱。默认仅自己可见。选择发布到 Skill Hub 时，系统会检查名称、说明、联系方式和近似重复项；符合规则的投稿自动公开，需要核对的投稿进入 `PENDING`，但创建者仍可使用。管理员可在“审核管理”处理待审核投稿。

Skill Hub 的每项官方技能都包含可单独搜索、添加和记录进度的子技能。技能详情可以沿“上级技能 / 细分技能”继续浏览；用户创建技能时也可指定上级技能。

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

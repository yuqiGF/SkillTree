package com.skilltree.catalog;

import com.skilltree.auth.AuthService;
import com.skilltree.common.Db;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

@Component
@Order(1)
public class SeedData implements CommandLineRunner {
    private final Db db;
    private final AuthService auth;
    @Value("${app.admin-email:}") private String adminEmail;
    @Value("${app.admin-password:}") private String adminPassword;
    public SeedData(Db db, AuthService auth) { this.db = db; this.auth = auth; }
    @Override public void run(String... args) {
        if (!adminEmail.isBlank() && !adminPassword.isBlank() && adminPassword.length() >= 8) {
            if (db.jdbc.queryForObject("SELECT COUNT(*) FROM users WHERE email=?", Long.class, adminEmail.toLowerCase()) == 0)
                db.insert("INSERT INTO users (username,email,password_hash,role) VALUES (?,?,?,'ADMIN')", "管理员", adminEmail.toLowerCase(), auth.passwordHash(adminPassword));
        }
        if (db.jdbc.queryForObject("SELECT COUNT(*) FROM categories", Long.class) > 0) return;
        long computer = category("计算机", "code");
        long design = category("设计", "palette");
        long language = category("语言", "languages");
        long art = category("艺术", "sparkles");
        long business = category("商业", "briefcase");
        long life = category("生活", "heart");
        long sport = category("运动", "activity");
        long management = category("管理", "users");
        long frontend = group(computer, "前端开发", "网页与交互界面");
        long backend = group(computer, "后端开发", "服务端编程与接口");
        long database = group(computer, "数据库", "数据存储与查询");
        long devops = group(computer, "DevOps", "交付、部署与运维");
        long ai = group(computer, "人工智能", "机器学习与智能应用");
        long basics = group(computer, "计算机基础", "通用开发能力");
        long visual = group(design, "视觉设计", "视觉表达与图形工具");
        long product = group(design, "产品设计", "体验与产品思维");
        long natural = group(language, "自然语言", "沟通与语言表达");
        long creative = group(art, "创作", "图像、音乐与写作");
        long strategy = group(business, "商业分析", "商业判断与数据思维");
        long everyday = group(life, "日常技能", "让生活更有趣");
        long fitness = group(sport, "体能运动", "身体与运动能力");
        long leadership = group(management, "团队管理", "组织和协作");
        skill("Java", backend, "通用的面向对象编程语言，常用于企业级应用。", "Java Language");
        skill("Spring Boot", backend, "快速构建 Java 后端服务的框架。", "Spring");
        skill("Python", backend, "适合自动化、后端和数据工作的编程语言。", "Py");
        skill("Node.js", backend, "基于 JavaScript 的服务端运行时。", "Node");
        skill("REST API", backend, "基于 HTTP 资源模型设计应用接口。", "REST");
        skill("JavaScript", frontend, "让网页拥有交互能力的编程语言。", "JS", "ECMAScript");
        skill("TypeScript", frontend, "为 JavaScript 加入静态类型的语言。", "TS");
        skill("React", frontend, "构建组件化用户界面的前端库。", "React.js");
        skill("Vue", frontend, "渐进式用户界面框架。", "Vue.js");
        skill("CSS", frontend, "定义网页视觉样式与布局。", "Cascading Style Sheets");
        skill("HTML", frontend, "构建网页内容结构。", "HyperText Markup Language");
        skill("MySQL", database, "流行的关系型数据库。", "My SQL");
        skill("PostgreSQL", database, "功能丰富的开源关系型数据库。", "Postgres");
        skill("Redis", database, "高速键值数据存储。", "Redis Cache");
        skill("SQL", database, "关系型数据库查询语言。", "Structured Query Language");
        skill("Docker", devops, "打包和运行容器化应用。", "容器");
        skill("Linux", devops, "开源操作系统及命令行环境。", "GNU/Linux");
        skill("Git", basics, "分布式版本控制工具。", "Git Version Control");
        skill("数据结构", basics, "组织和处理数据的基本方式。", "Data Structures");
        skill("算法", basics, "设计高效计算过程的能力。", "Algorithms");
        skill("机器学习", ai, "让模型从数据中学习模式。", "Machine Learning", "ML");
        skill("Prompt Engineering", ai, "设计与优化大模型提示词。", "提示词工程");
        skill("Figma", visual, "协作式界面和视觉设计工具。");
        skill("Photoshop", visual, "图像编辑与视觉创作工具。", "PS", "Adobe Photoshop");
        skill("UI 设计", product, "设计清晰、美观的用户界面。", "UI Design");
        skill("用户研究", product, "理解用户需求与使用场景。", "UX Research");
        skill("英语", natural, "英语阅读、表达与交流。", "English");
        skill("日语", natural, "日语阅读、表达与交流。", "Japanese");
        skill("摄影", creative, "用光线、构图和设备记录画面。", "Photography");
        skill("写作", creative, "组织观点并清晰表达的能力。", "Writing");
        skill("数据分析", strategy, "从数据中发现趋势与问题。", "Data Analysis");
        skill("市场营销", strategy, "理解市场并推广产品或服务。", "Marketing");
        skill("烹饪", everyday, "制作美味、健康的餐食。", "Cooking");
        skill("跑步", fitness, "基础耐力运动。", "Running");
        skill("游泳", fitness, "水中运动与自救能力。", "Swimming");
        skill("项目管理", leadership, "协调资源、时间与目标推进项目。", "Project Management");
    }
    private long category(String name, String icon) { return db.insert("INSERT INTO categories (name,icon) VALUES (?,?)", name, icon); }
    private long group(long categoryId, String name, String description) { return db.insert("INSERT INTO skill_groups (category_id,name,description) VALUES (?,?,?)", categoryId, name, description); }
    private void skill(String name, long groupId, String description, String... aliases) {
        long id = db.insert("INSERT INTO skills (name,normalized_name,description,group_id,source_type,status,difficulty) VALUES (?,?,?,?,'OFFICIAL','APPROVED',2)", name, CatalogController.normalize(name), description, groupId);
        for (String alias : aliases) db.insert("INSERT INTO skill_aliases (skill_id,alias,normalized_alias) VALUES (?,?,?)", id, alias, CatalogController.normalize(alias));
    }
}

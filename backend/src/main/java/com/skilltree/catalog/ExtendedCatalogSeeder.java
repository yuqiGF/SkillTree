package com.skilltree.catalog;

import com.skilltree.common.Db;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

@Component
@Order(2)
public class ExtendedCatalogSeeder implements CommandLineRunner {
    private final Db db;
    private final TransactionTemplate transactions;

    public ExtendedCatalogSeeder(Db db, TransactionTemplate transactions) {
        this.db = db;
        this.transactions = transactions;
    }

    @Override public void run(String... args) throws Exception {
        try (var reader = new BufferedReader(new InputStreamReader(
            new ClassPathResource("extended-skills.txt").getInputStream(), StandardCharsets.UTF_8))) {
            var lines = reader.lines().filter(line -> !line.isBlank() && !line.startsWith("#")).toList();
            transactions.executeWithoutResult(status -> importLines(lines));
        }
    }

    private void importLines(java.util.List<String> lines) {
        Set<String> existing = new HashSet<>(db.jdbc.queryForList(
            "SELECT normalized_name FROM skills WHERE status='APPROVED'", String.class));
        Map<String, Long> categories = new HashMap<>();
        Map<String, Long> groups = new HashMap<>();
        for (String line : lines) {
            String[] parts = line.split("\\|", 3);
            if (parts.length != 3) throw new IllegalStateException("无效技能目录行: " + line);
            String categoryName = parts[0].trim();
            String groupName = parts[1].trim();
            long categoryId = categories.computeIfAbsent(categoryName, name -> {
                var ids = db.jdbc.queryForList("SELECT id FROM categories WHERE name=?", Long.class, name);
                if (!ids.isEmpty()) return ids.getFirst();
                String icon = switch (name) {
                    case "计算机" -> "code";
                    case "设计" -> "palette";
                    case "语言" -> "languages";
                    case "艺术" -> "sparkles";
                    case "商业" -> "briefcase";
                    case "生活" -> "heart";
                    case "运动" -> "activity";
                    case "管理" -> "users";
                    default -> "grid";
                };
                return db.insert("INSERT INTO categories (name,icon) VALUES (?,?)", name, icon);
            });
            long groupId = groups.computeIfAbsent(categoryName + "|" + groupName, key -> {
                var ids = db.jdbc.queryForList("SELECT id FROM skill_groups WHERE category_id=? AND name=?",
                    Long.class, categoryId, groupName);
                return ids.isEmpty()
                    ? db.insert("INSERT INTO skill_groups (category_id,name,description) VALUES (?,?,?)",
                        categoryId, groupName, groupName + "相关技能")
                    : ids.getFirst();
            });
            for (String item : parts[2].split(";")) {
                String name = item.trim();
                if (name.isEmpty()) continue;
                String normalized = CatalogController.normalize(name);
                if (!existing.add(normalized)) continue;
                db.insert("INSERT INTO skills (name,normalized_name,description,group_id,source_type,status,difficulty) VALUES (?,?,?,?,'OFFICIAL','APPROVED',2)",
                    name, normalized, "学习和实践" + name + "，掌握" + groupName + "相关能力。", groupId);
            }
        }
    }
}

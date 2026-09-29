package com.skilltree.catalog;

import com.skilltree.common.Db;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionTemplate;

@Component
@Order(3)
public class SubskillSeeder implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(SubskillSeeder.class);
    private final Db db;
    private final TransactionTemplate transactions;

    public SubskillSeeder(Db db, TransactionTemplate transactions) {
        this.db = db;
        this.transactions = transactions;
    }

    @Override public void run(String... args) throws Exception {
        List<String> templateLines = lines("subskill-templates.txt");
        List<String> curatedLines = lines("curated-subskills.txt");
        transactions.executeWithoutResult(status -> importSubskills(templateLines, curatedLines));
    }

    private List<String> lines(String resource) throws IOException {
        try (var reader = new BufferedReader(new InputStreamReader(
            new ClassPathResource(resource).getInputStream(), StandardCharsets.UTF_8))) {
            return reader.lines().filter(line -> !line.isBlank() && !line.startsWith("#")).toList();
        }
    }

    private void importSubskills(List<String> templateLines, List<String> curatedLines) {
        Map<String, List<String>> templates = parseEntries(templateLines, false);
        Map<String, List<String>> curated = parseEntries(curatedLines, true);
        List<Map<String, Object>> roots = db.jdbc.queryForList(
            "SELECT s.id,s.name,s.group_id AS groupId,g.name AS groupName,c.name AS categoryName " +
            "FROM skills s JOIN skill_groups g ON g.id=s.group_id JOIN categories c ON c.id=g.category_id " +
            "WHERE s.source_type='OFFICIAL' AND s.status='APPROVED' ORDER BY s.id");
        Map<String, Long> skillIds = new HashMap<>();
        for (Map<String, Object> row : db.jdbc.queryForList(
            "SELECT id,normalized_name FROM skills WHERE status='APPROVED' ORDER BY id"))
            skillIds.putIfAbsent((String) row.get("normalized_name"), Db.id(row));
        Set<Relation> relationships = new HashSet<>();
        for (Map<String, Object> row : db.jdbc.queryForList(
            "SELECT parent_skill_id,child_skill_id FROM skill_subskills"))
            relationships.add(new Relation(((Number) row.get("parent_skill_id")).longValue(),
                ((Number) row.get("child_skill_id")).longValue()));
        Set<String> usedCurated = new HashSet<>();
        int[] changes = new int[2];

        for (Map<String, Object> root : roots) {
            long parentId = Db.id(root);
            long groupId = ((Number) root.get("groupId")).longValue();
            String parentName = (String) root.get("name");
            String parentKey = CatalogController.normalize(parentName);
            String category = (String) root.get("categoryName");
            String group = (String) root.get("groupName");
            List<String> facets = templates.getOrDefault(category + "/" + group, templates.get(category));
            if (facets == null || facets.isEmpty())
                throw new IllegalStateException("技能分类缺少细分规则: " + category + "/" + group);
            int position = 0;
            List<String> named = curated.get(parentKey);
            if (named != null) {
                usedCurated.add(parentKey);
                for (String childName : named)
                    addChild(parentId, groupId, parentName, childName, position++, skillIds, relationships, changes);
            }
            for (String facet : facets)
                addChild(parentId, groupId, parentName, parentName + " · " + facet,
                    position++, skillIds, relationships, changes);
        }
        Set<String> remaining = new HashSet<>(curated.keySet());
        remaining.removeAll(usedCurated);
        while (!remaining.isEmpty()) {
            int before = remaining.size();
            for (String key : new HashSet<>(remaining)) {
                Long parentId = skillIds.get(key);
                if (parentId == null) continue;
                Map<String, Object> parent = db.one("SELECT name,group_id FROM skills WHERE id=?", parentId);
                String parentName = (String) parent.get("name");
                long groupId = ((Number) parent.get("group_id")).longValue();
                int position = 0;
                for (String childName : curated.get(key))
                    addChild(parentId, groupId, parentName, childName, position++, skillIds, relationships, changes);
                remaining.remove(key);
            }
            if (remaining.size() == before)
                throw new IllegalStateException("具名子技能的上级技能不存在: " + remaining);
        }
        log.info("Subskill catalog ready: {} official parents, {} new skills, {} new links",
            roots.size(), changes[0], changes[1]);
    }

    private Map<String, List<String>> parseEntries(List<String> lines, boolean normalizeKeys) {
        Map<String, List<String>> entries = new HashMap<>();
        for (String line : lines) {
            String[] parts = line.split("\\|", 2);
            if (parts.length != 2) throw new IllegalStateException("无效子技能目录行: " + line);
            String key = normalizeKeys ? CatalogController.normalize(parts[0]) : parts[0].trim();
            List<String> values = new ArrayList<>();
            for (String value : parts[1].split(";")) if (!value.isBlank()) values.add(value.trim());
            if (values.isEmpty() || entries.putIfAbsent(key, values) != null)
                throw new IllegalStateException("重复或空的子技能目录行: " + key);
        }
        return entries;
    }

    private void addChild(long parentId, long groupId, String parentName, String childName,
        int position, Map<String, Long> skillIds, Set<Relation> relationships, int[] changes) {
        String normalized = CatalogController.normalize(childName);
        Long childId = skillIds.get(normalized);
        if (childId == null) {
            childId = db.insert("INSERT INTO skills (name,normalized_name,description,group_id,source_type,status,difficulty) " +
                "VALUES (?,?,?,?,'DERIVED','APPROVED',2)", childName, normalized,
                "掌握" + childName + "，作为" + parentName + "的细分能力。", groupId);
            skillIds.put(normalized, childId);
            changes[0]++;
        }
        if (parentId == childId) return;
        Relation relation = new Relation(parentId, childId);
        if (relationships.add(relation)) {
            db.jdbc.update("INSERT INTO skill_subskills (parent_skill_id,child_skill_id,sort_order) VALUES (?,?,?)",
                parentId, childId, position);
            changes[1]++;
        }
    }

    private record Relation(long parentId, long childId) {}
}

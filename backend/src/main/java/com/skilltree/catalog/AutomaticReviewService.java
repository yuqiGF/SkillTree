package com.skilltree.catalog;

import com.skilltree.common.Db;
import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class AutomaticReviewService {
    private final Db db;
    public AutomaticReviewService(Db db) { this.db = db; }
    public record Decision(String status, String reason) {}

    public Decision review(String name, String description, List<String> aliases) {
        String cleanName = CatalogController.normalize(name);
        String cleanDescription = description == null ? "" : description.trim();
        if (cleanName.length() < 3 || cleanDescription.length() < 20)
            return new Decision("PENDING", "名称或说明过短，请管理员确认技能定义");
        String content = name + " " + cleanDescription + " " + String.join(" ", aliases == null ? List.of() : aliases);
        if (content.matches("(?is).*(https?://|www\\.|[a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,}|(?:微信|加微|QQ|vx|v信)[:：\\s]*[a-z0-9]{4,}).*"))
            return new Decision("PENDING", "包含链接或联系方式，需要人工核对");
        for (String existing : db.jdbc.queryForList("SELECT normalized_name FROM skills WHERE status='APPROVED'", String.class)) {
            if (looksSimilar(cleanName, existing))
                return new Decision("PENDING", "与已有技能名称相近，需要人工核对");
        }
        for (String alias : aliases == null ? List.<String>of() : aliases) {
            String normalized = CatalogController.normalize(alias);
            if (!normalized.isEmpty() && db.jdbc.queryForObject(
                "SELECT COUNT(*) FROM skills s WHERE s.status='APPROVED' AND (s.normalized_name=? OR EXISTS (SELECT 1 FROM skill_aliases a WHERE a.skill_id=s.id AND a.normalized_alias=?))",
                Long.class, normalized, normalized) > 0)
                return new Decision("PENDING", "别名与已有技能重合，需要人工核对");
        }
        return new Decision("APPROVED", "自动审核通过：名称、说明及重复项检查完成");
    }

    private boolean looksSimilar(String left, String right) {
        if (left.equals(right)) return true;
        if (left.length() < 4 || right.length() < 4 || Math.abs(left.length() - right.length()) > 2) return false;
        int[] previous = new int[right.length() + 1];
        for (int j = 0; j <= right.length(); j++) previous[j] = j;
        for (int i = 1; i <= left.length(); i++) {
            int[] current = new int[right.length() + 1]; current[0] = i;
            for (int j = 1; j <= right.length(); j++)
                current[j] = Math.min(Math.min(previous[j] + 1, current[j - 1] + 1),
                    previous[j - 1] + (left.charAt(i - 1) == right.charAt(j - 1) ? 0 : 1));
            previous = current;
        }
        return previous[right.length()] <= 1;
    }
}

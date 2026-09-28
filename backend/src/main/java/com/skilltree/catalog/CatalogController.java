package com.skilltree.catalog;

import com.skilltree.auth.AuthService;
import com.skilltree.common.ApiException;
import com.skilltree.common.Db;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api")
public class CatalogController {
    private final Db db;
    private final AuthService auth;
    private final AutomaticReviewService automaticReview;
    public CatalogController(Db db, AuthService auth, AutomaticReviewService automaticReview) { this.db = db; this.auth = auth; this.automaticReview = automaticReview; }
    public static String normalize(String text) { return Normalizer.normalize(text.strip(), Normalizer.Form.NFKC).toLowerCase().replaceAll("\\s+", ""); }
    public record UserSkillInput(@Min(1) @Max(5) int level, @NotBlank String status, @Size(max=1000) String note) {}
    public record Submission(@NotBlank @Size(max=100) String name, @NotNull Long groupId, @Size(max=4000) String description, List<@Size(max=100) String> aliases, @NotBlank String visibility) {}

    @GetMapping("/categories")
    public List<Map<String, Object>> categories() {
        List<Map<String, Object>> categories = db.jdbc.queryForList("SELECT id,name,icon FROM categories ORDER BY id");
        for (Map<String, Object> category : categories)
            category.put("groups", db.jdbc.queryForList("SELECT id,name,description FROM skill_groups WHERE category_id=? ORDER BY id", category.get("id")));
        return categories;
    }
    @GetMapping({"/skills", "/skills/search"})
    public List<Map<String, Object>> skills(@RequestParam(required=false) String q, @RequestParam(required=false) Long categoryId,
        @RequestParam(required=false) Long groupId, @RequestParam(defaultValue="0") @Min(0) @Max(1000) int page,
        @RequestHeader(value="Authorization",required=false) String authorization) {
        long userId = authorization == null ? -1 : auth.userId(authorization);
        StringBuilder sql = new StringBuilder("SELECT s.id,s.name,s.description,s.source_type AS sourceType,s.status,s.difficulty,g.id AS groupId,g.name AS groupName,c.id AS categoryId,c.name AS categoryName,(SELECT COUNT(*) FROM user_skills us WHERE us.skill_id=s.id) AS usageCount FROM skills s JOIN skill_groups g ON g.id=s.group_id JOIN categories c ON c.id=g.category_id WHERE (s.status='APPROVED' OR s.creator_id=?)");
        List<Object> args = new ArrayList<>(); args.add(userId);
        if (categoryId != null) { sql.append(" AND c.id=?"); args.add(categoryId); }
        if (groupId != null) { sql.append(" AND g.id=?"); args.add(groupId); }
        if (q != null && !q.isBlank()) {
            sql.append(" AND (s.normalized_name LIKE ? OR EXISTS (SELECT 1 FROM skill_aliases a WHERE a.skill_id=s.id AND a.normalized_alias LIKE ?))");
            String needle = "%" + normalize(q) + "%"; args.add(needle); args.add(needle);
            sql.append(" ORDER BY CASE WHEN s.normalized_name=? THEN 0 WHEN EXISTS (SELECT 1 FROM skill_aliases a WHERE a.skill_id=s.id AND a.normalized_alias=?) THEN 1 WHEN s.normalized_name LIKE ? THEN 2 ELSE 3 END,usageCount DESC,s.name");
            args.add(normalize(q)); args.add(normalize(q)); args.add(normalize(q) + "%");
        } else sql.append(" ORDER BY usageCount DESC,s.id");
        sql.append(" LIMIT 60 OFFSET ?"); args.add(page * 60);
        return db.jdbc.queryForList(sql.toString(), args.toArray());
    }
    @GetMapping("/skills/{id}")
    public Map<String, Object> skill(@PathVariable long id, @RequestHeader(value="Authorization",required=false) String authorization) {
        long userId = authorization == null ? -1 : auth.userId(authorization);
        Map<String, Object> skill = db.one("SELECT s.id,s.name,s.description,s.source_type AS sourceType,s.status,s.difficulty,s.creator_id AS creatorId,g.id AS groupId,g.name AS groupName,c.id AS categoryId,c.name AS categoryName FROM skills s JOIN skill_groups g ON g.id=s.group_id JOIN categories c ON c.id=g.category_id WHERE s.id=?", id);
        if (!"APPROVED".equals(skill.get("status")) && !Long.valueOf(userId).equals(((Number) skill.get("creatorId")).longValue()))
            throw new ApiException(HttpStatus.NOT_FOUND, "技能不存在");
        skill.put("aliases", db.jdbc.queryForList("SELECT alias FROM skill_aliases WHERE skill_id=? ORDER BY id", id).stream().map(row -> row.get("alias")).toList());
        return skill;
    }
    public void requireVisibleSkill(long skillId, long userId) {
        List<Map<String,Object>> rows = db.jdbc.queryForList("SELECT id FROM skills WHERE id=? AND (status='APPROVED' OR creator_id=?)", skillId, userId);
        if (rows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "技能不存在");
    }
    @GetMapping("/me/skills")
    public List<Map<String,Object>> mySkills(@RequestHeader(value="Authorization",required=false) String authorization) {
        long userId = auth.userId(authorization);
        return db.jdbc.queryForList("SELECT s.id,s.name,s.description,s.source_type AS sourceType,u.level,u.status,u.note,g.name AS groupName,c.name AS categoryName FROM user_skills u JOIN skills s ON s.id=u.skill_id JOIN skill_groups g ON g.id=s.group_id JOIN categories c ON c.id=g.category_id WHERE u.user_id=? ORDER BY u.updated_at DESC", userId);
    }
    @PutMapping("/me/skills/{skillId}")
    @Transactional
    public Map<String,Object> saveMySkill(@PathVariable long skillId, @Valid @RequestBody UserSkillInput input,
        @RequestHeader(value="Authorization",required=false) String authorization) {
        long userId = auth.userId(authorization); requireVisibleSkill(skillId, userId);
        if (!List.of("WANT_TO_LEARN","LEARNING","MASTERED","PROFICIENT","EXPERT").contains(input.status()))
            throw new ApiException(HttpStatus.BAD_REQUEST, "技能状态无效");
        int changed = db.jdbc.update("UPDATE user_skills SET level=?,status=?,note=?,updated_at=CURRENT_TIMESTAMP WHERE user_id=? AND skill_id=?",
            input.level(), input.status(), input.note(), userId, skillId);
        if (changed == 0) db.insert("INSERT INTO user_skills (user_id,skill_id,level,status,note) VALUES (?,?,?,?,?)", userId, skillId, input.level(), input.status(), input.note());
        return db.one("SELECT skill_id AS skillId,level,status,note FROM user_skills WHERE user_id=? AND skill_id=?", userId, skillId);
    }
    @DeleteMapping("/me/skills/{skillId}")
    public void removeMySkill(@PathVariable long skillId, @RequestHeader(value="Authorization",required=false) String authorization) {
        db.jdbc.update("DELETE FROM user_skills WHERE user_id=? AND skill_id=?", auth.userId(authorization), skillId);
    }
    @PostMapping("/skills/submissions")
    @Transactional
    public Map<String,Object> submit(@Valid @RequestBody Submission input, @RequestHeader(value="Authorization",required=false) String authorization) {
        long userId = auth.userId(authorization);
        String name = input.name().trim(); String normalized = normalize(name);
        if (normalized.isEmpty()) throw new ApiException(HttpStatus.BAD_REQUEST, "请输入技能名称");
        if (!List.of("PRIVATE","COMMUNITY").contains(input.visibility())) throw new ApiException(HttpStatus.BAD_REQUEST, "请选择提交方式");
        if (db.jdbc.queryForObject("SELECT COUNT(*) FROM skill_groups WHERE id=?", Long.class, input.groupId()) == 0)
            throw new ApiException(HttpStatus.BAD_REQUEST, "技能组不存在");
        if (db.jdbc.queryForObject("SELECT COUNT(*) FROM skills s WHERE s.status='APPROVED' AND (s.normalized_name=? OR EXISTS (SELECT 1 FROM skill_aliases a WHERE a.skill_id=s.id AND a.normalized_alias=?))", Long.class, normalized, normalized) > 0)
            throw new ApiException(HttpStatus.CONFLICT, "已有同名技能，请优先使用 Skill Hub 中的技能");
        if (db.jdbc.queryForObject("SELECT COUNT(*) FROM skills WHERE creator_id=? AND normalized_name=? AND status<>'REJECTED'", Long.class, userId, normalized) > 0)
            throw new ApiException(HttpStatus.CONFLICT, "你已经创建或提交过这个技能");
        var decision = input.visibility().equals("PRIVATE") ? null : automaticReview.review(name, input.description(), input.aliases());
        String status = decision == null ? "PRIVATE" : decision.status();
        long id = db.insert("INSERT INTO skills (name,normalized_name,description,group_id,creator_id,source_type,status,difficulty) VALUES (?,?,?,?,?,?,?,2)",
            name, normalized, input.description(), input.groupId(), userId, input.visibility(), status);
        if (input.aliases() != null) for (String alias : input.aliases()) {
            if (alias == null || alias.isBlank()) continue;
            if (!normalize(alias).equals(normalized)) db.insert("INSERT INTO skill_aliases (skill_id,alias,normalized_alias) VALUES (?,?,?)", id, alias.trim(), normalize(alias));
        }
        db.insert("INSERT INTO user_skills (user_id,skill_id,level,status,note) VALUES (?,?,1,'WANT_TO_LEARN','')", userId, id);
        if (decision != null) db.insert("INSERT INTO skill_reviews (skill_id,reason) VALUES (?,?)", id, decision.reason());
        var result = skill(id, authorization);
        result.put("reviewReason", decision == null ? "仅自己可见" : decision.reason());
        return result;
    }
    @GetMapping("/me/submissions")
    public List<Map<String,Object>> mySubmissions(@RequestHeader(value="Authorization",required=false) String authorization) {
        return db.jdbc.queryForList("SELECT s.id,s.name,s.status,s.source_type AS sourceType,g.name AS groupName,r.reason AS reviewReason FROM skills s JOIN skill_groups g ON g.id=s.group_id LEFT JOIN skill_reviews r ON r.skill_id=s.id WHERE s.creator_id=? ORDER BY s.id DESC", auth.userId(authorization));
    }
    @GetMapping("/admin/submissions")
    public List<Map<String,Object>> pending(@RequestHeader(value="Authorization",required=false) String authorization) {
        auth.admin(authorization);
        return db.jdbc.queryForList("SELECT s.id,s.name,s.description,g.name AS groupName,u.username AS creatorName,r.reason AS reviewReason FROM skills s JOIN skill_groups g ON g.id=s.group_id JOIN users u ON u.id=s.creator_id LEFT JOIN skill_reviews r ON r.skill_id=s.id WHERE s.status='PENDING' ORDER BY s.id");
    }
    @PostMapping("/admin/submissions/{id}/{decision}")
    @Transactional
    public Map<String,Object> review(@PathVariable long id, @PathVariable String decision,
        @RequestHeader(value="Authorization",required=false) String authorization) {
        auth.admin(authorization);
        if (!List.of("approve","reject").contains(decision)) throw new ApiException(HttpStatus.BAD_REQUEST, "审核操作无效");
        Map<String,Object> submission = db.one("SELECT id,normalized_name,status FROM skills WHERE id=?", id);
        if (!"PENDING".equals(submission.get("status"))) throw new ApiException(HttpStatus.CONFLICT, "该技能不在待审核状态");
        if (decision.equals("approve") && db.jdbc.queryForObject("SELECT COUNT(*) FROM skills WHERE normalized_name=? AND status='APPROVED'", Long.class, submission.get("normalized_name")) > 0)
            throw new ApiException(HttpStatus.CONFLICT, "Skill Hub 已有同名技能");
        db.jdbc.update("UPDATE skills SET status=? WHERE id=?", decision.equals("approve") ? "APPROVED" : "REJECTED", id);
        db.jdbc.update("UPDATE skill_reviews SET reason=?,reviewed_at=CURRENT_TIMESTAMP WHERE skill_id=?", decision.equals("approve") ? "管理员审核通过" : "管理员审核未通过", id);
        return Map.of("id", id, "status", decision.equals("approve") ? "APPROVED" : "REJECTED");
    }
}

package com.skilltree.tree;

import com.skilltree.auth.AuthService;
import com.skilltree.catalog.CatalogController;
import com.skilltree.common.ApiException;
import com.skilltree.common.Db;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.ArrayDeque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/trees")
public class TreeController {
    private final Db db;
    private final AuthService auth;
    private final CatalogController catalog;
    public TreeController(Db db, AuthService auth, CatalogController catalog) { this.db=db; this.auth=auth; this.catalog=catalog; }
    public record TreeInput(@NotBlank @Size(max=100) String name, @Size(max=500) String description) {}
    public record NodeInput(@NotNull Long skillId, double x, double y) {}
    public record Position(double x, double y) {}
    public record EdgeInput(@NotNull Long sourceNodeId, @NotNull Long targetNodeId) {}

    @GetMapping
    public List<Map<String,Object>> list(@RequestHeader(value="Authorization",required=false) String authorization) {
        return db.jdbc.queryForList("SELECT t.id,t.name,t.description,t.visibility,t.created_at AS createdAt,(SELECT COUNT(*) FROM tree_nodes n WHERE n.tree_id=t.id) AS nodeCount FROM trees t WHERE t.user_id=? ORDER BY t.id DESC", auth.userId(authorization));
    }
    @PostMapping
    public Map<String,Object> create(@Valid @RequestBody TreeInput input, @RequestHeader(value="Authorization",required=false) String authorization) {
        long id = db.insert("INSERT INTO trees (user_id,name,description,visibility) VALUES (?,?,?,'PRIVATE')", auth.userId(authorization), input.name().trim(), input.description());
        return db.one("SELECT id,name,description,visibility FROM trees WHERE id=?", id);
    }
    private Map<String,Object> own(long id, String authorization) {
        long userId = auth.userId(authorization);
        List<Map<String,Object>> rows = db.jdbc.queryForList("SELECT id,user_id AS userId,name,description,visibility FROM trees WHERE id=? AND user_id=?", id, userId);
        if (rows.isEmpty()) throw new ApiException(HttpStatus.NOT_FOUND, "技能树不存在");
        return rows.getFirst();
    }
    @GetMapping("/{id}")
    public Map<String,Object> detail(@PathVariable long id, @RequestHeader(value="Authorization",required=false) String authorization) {
        Map<String,Object> tree = own(id, authorization);
        List<Map<String,Object>> nodes = db.jdbc.queryForList("SELECT n.id,n.skill_id AS skillId,n.x,n.y,n.custom_label AS customLabel,s.name,s.description,u.level,u.status,u.note FROM tree_nodes n JOIN skills s ON s.id=n.skill_id LEFT JOIN user_skills u ON u.skill_id=s.id AND u.user_id=? WHERE n.tree_id=? ORDER BY n.id", auth.userId(authorization), id);
        List<Map<String,Object>> edges = db.jdbc.queryForList("SELECT id,source_node_id AS sourceNodeId,target_node_id AS targetNodeId FROM tree_edges WHERE tree_id=? ORDER BY id", id);
        return Map.of("tree",tree,"nodes",nodes,"edges",edges);
    }
    @PutMapping("/{id}")
    public Map<String,Object> rename(@PathVariable long id, @Valid @RequestBody TreeInput input,
        @RequestHeader(value="Authorization",required=false) String authorization) {
        own(id,authorization);
        db.jdbc.update("UPDATE trees SET name=?,description=? WHERE id=?",input.name().trim(),input.description(),id);
        return own(id,authorization);
    }
    @DeleteMapping("/{id}")
    public void delete(@PathVariable long id, @RequestHeader(value="Authorization",required=false) String authorization) {
        own(id,authorization); db.jdbc.update("DELETE FROM trees WHERE id=?",id);
    }
    @PostMapping("/{id}/nodes")
    @Transactional
    public Map<String,Object> addNode(@PathVariable long id, @Valid @RequestBody NodeInput input,
        @RequestHeader(value="Authorization",required=false) String authorization) {
        own(id,authorization); long userId = auth.userId(authorization);
        catalog.requireVisibleSkill(input.skillId(),userId);
        validatePosition(input.x(), input.y());
        if (db.jdbc.queryForObject("SELECT COUNT(*) FROM tree_nodes WHERE tree_id=? AND skill_id=?",Long.class,id,input.skillId())>0)
            throw new ApiException(HttpStatus.CONFLICT,"这个技能已经在当前技能树中");
        long nodeId = db.insert("INSERT INTO tree_nodes (tree_id,skill_id,x,y) VALUES (?,?,?,?)",id,input.skillId(),input.x(),input.y());
        if (db.jdbc.queryForObject("SELECT COUNT(*) FROM user_skills WHERE user_id=? AND skill_id=?",Long.class,userId,input.skillId())==0)
            db.insert("INSERT INTO user_skills (user_id,skill_id,level,status) VALUES (?,?,1,'WANT_TO_LEARN')",userId,input.skillId());
        return db.one("SELECT n.id,n.skill_id AS skillId,n.x,n.y,s.name FROM tree_nodes n JOIN skills s ON s.id=n.skill_id WHERE n.id=?",nodeId);
    }
    private void validatePosition(double x,double y) {
        if (!Double.isFinite(x) || !Double.isFinite(y) || Math.abs(x)>100000 || Math.abs(y)>100000)
            throw new ApiException(HttpStatus.BAD_REQUEST,"节点坐标无效");
    }
    @PatchMapping("/{id}/nodes/{nodeId}")
    public Map<String,Object> moveNode(@PathVariable long id,@PathVariable long nodeId,@RequestBody Position input,
        @RequestHeader(value="Authorization",required=false) String authorization) {
        own(id,authorization); validatePosition(input.x(),input.y());
        int changed=db.jdbc.update("UPDATE tree_nodes SET x=?,y=? WHERE id=? AND tree_id=?",input.x(),input.y(),nodeId,id);
        if (changed==0) throw new ApiException(HttpStatus.NOT_FOUND,"节点不存在");
        return Map.of("id",nodeId,"x",input.x(),"y",input.y());
    }
    @DeleteMapping("/{id}/nodes/{nodeId}")
    public void deleteNode(@PathVariable long id,@PathVariable long nodeId,@RequestHeader(value="Authorization",required=false) String authorization) {
        own(id,authorization); db.jdbc.update("DELETE FROM tree_nodes WHERE id=? AND tree_id=?",nodeId,id);
    }
    @PostMapping("/{id}/edges")
    @Transactional
    public Map<String,Object> addEdge(@PathVariable long id,@Valid @RequestBody EdgeInput input,
        @RequestHeader(value="Authorization",required=false) String authorization) {
        own(id,authorization);
        long source=input.sourceNodeId(), target=input.targetNodeId();
        if (source==target) throw new ApiException(HttpStatus.BAD_REQUEST,"节点不能连接自己");
        if (db.jdbc.queryForObject("SELECT COUNT(*) FROM tree_nodes WHERE tree_id=? AND id IN (?,?)",Long.class,id,source,target)!=2)
            throw new ApiException(HttpStatus.BAD_REQUEST,"只能连接当前技能树中的节点");
        List<Map<String,Object>> rows=db.jdbc.queryForList("SELECT source_node_id,target_node_id FROM tree_edges WHERE tree_id=?",id);
        Map<Long,Set<Long>> graph=new HashMap<>();
        for (Map<String,Object> row:rows) graph.computeIfAbsent(((Number)row.get("source_node_id")).longValue(),key->new HashSet<>()).add(((Number)row.get("target_node_id")).longValue());
        if (graph.getOrDefault(source,Set.of()).contains(target)) throw new ApiException(HttpStatus.CONFLICT,"连线已存在");
        ArrayDeque<Long> queue=new ArrayDeque<>(); Set<Long> visited=new HashSet<>(); queue.add(target);
        while (!queue.isEmpty()) {
            long current=queue.removeFirst();
            if (current==source) throw new ApiException(HttpStatus.CONFLICT,"这条连线会形成循环，请调整连接方向");
            if (visited.add(current)) queue.addAll(graph.getOrDefault(current,Set.of()));
        }
        long edgeId=db.insert("INSERT INTO tree_edges (tree_id,source_node_id,target_node_id) VALUES (?,?,?)",id,source,target);
        return Map.of("id",edgeId,"sourceNodeId",source,"targetNodeId",target);
    }
    @DeleteMapping("/{id}/edges/{edgeId}")
    public void deleteEdge(@PathVariable long id,@PathVariable long edgeId,@RequestHeader(value="Authorization",required=false) String authorization) {
        own(id,authorization); db.jdbc.update("DELETE FROM tree_edges WHERE id=? AND tree_id=?",edgeId,id);
    }
}

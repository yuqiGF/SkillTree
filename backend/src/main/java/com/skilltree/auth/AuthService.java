package com.skilltree.auth;

import com.skilltree.common.ApiException;
import com.skilltree.common.Db;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AuthService {
    private final Db db;
    private final BCryptPasswordEncoder encoder = new BCryptPasswordEncoder();
    private final SecureRandom random = new SecureRandom();
    public AuthService(Db db) { this.db = db; }

    public Map<String, Object> require(String authorization) {
        if (authorization == null || !authorization.startsWith("Bearer "))
            throw new ApiException(HttpStatus.UNAUTHORIZED, "请先登录");
        String token = authorization.substring(7);
        if (token.length() != 64) throw new ApiException(HttpStatus.UNAUTHORIZED, "登录已失效");
        List<Map<String, Object>> rows = db.jdbc.queryForList(
            "SELECT u.id, u.username, u.email, u.role FROM auth_tokens t JOIN users u ON u.id=t.user_id WHERE t.token_hash=? AND t.expires_at>?",
            hash(token), System.currentTimeMillis());
        if (rows.isEmpty()) throw new ApiException(HttpStatus.UNAUTHORIZED, "登录已失效，请重新登录");
        return rows.getFirst();
    }
    public long userId(String authorization) { return ((Number) require(authorization).get("id")).longValue(); }
    public Map<String, Object> admin(String authorization) {
        Map<String, Object> user = require(authorization);
        if (!"ADMIN".equals(user.get("role"))) throw new ApiException(HttpStatus.FORBIDDEN, "需要管理员权限");
        return user;
    }
    public String issue(long userId) {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String token = HexFormat.of().formatHex(bytes);
        db.jdbc.update("INSERT INTO auth_tokens (token_hash,user_id,expires_at) VALUES (?,?,?)",
            hash(token), userId, System.currentTimeMillis() + Duration.ofDays(30).toMillis());
        return token;
    }
    public void revoke(String authorization) {
        require(authorization);
        db.jdbc.update("DELETE FROM auth_tokens WHERE token_hash=?", hash(authorization.substring(7)));
    }
    public String passwordHash(String password) { return encoder.encode(password); }
    public boolean passwordMatches(String password, String hash) { return encoder.matches(password, hash); }
    private String hash(String token) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest);
        } catch (Exception e) { throw new IllegalStateException(e); }
    }
}

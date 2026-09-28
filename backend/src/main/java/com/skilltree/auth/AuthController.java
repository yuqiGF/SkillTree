package com.skilltree.auth;

import com.skilltree.common.ApiException;
import com.skilltree.common.Db;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final Db db;
    private final AuthService auth;
    public AuthController(Db db, AuthService auth) { this.db = db; this.auth = auth; }
    public record Register(@NotBlank @Size(min=2,max=40) String username, @Email @NotBlank String email, @Size(min=8,max=72) String password) {}
    public record Login(@NotBlank String email, @NotBlank String password) {}
    public record Profile(@NotBlank @Size(min=2,max=40) String username) {}
    public record ChangePassword(@NotBlank String currentPassword, @Size(min=8,max=72) String newPassword) {}

    @PostMapping("/register")
    public Map<String, Object> register(@Valid @RequestBody Register input) {
        String email = input.email().trim().toLowerCase();
        long id = db.insert("INSERT INTO users (username,email,password_hash,role) VALUES (?,?,?,'USER')",
            input.username().trim(), email, auth.passwordHash(input.password()));
        return Map.of("token", auth.issue(id), "user", db.one("SELECT id,username,email,role FROM users WHERE id=?", id));
    }
    @PostMapping("/login")
    public Map<String, Object> login(@Valid @RequestBody Login input) {
        String account = input.email().trim();
        List<Map<String, Object>> rows = db.jdbc.queryForList("SELECT * FROM users WHERE email=? OR username=?", account.toLowerCase(), account);
        if (rows.isEmpty() || !auth.passwordMatches(input.password(), (String) rows.getFirst().get("password_hash")))
            throw new ApiException(HttpStatus.UNAUTHORIZED, "账号或密码不正确");
        long id = Db.id(rows.getFirst());
        return Map.of("token", auth.issue(id), "user", db.one("SELECT id,username,email,role FROM users WHERE id=?", id));
    }
    @GetMapping("/me")
    public Map<String, Object> me(@RequestHeader(value="Authorization",required=false) String authorization) { return auth.require(authorization); }
    @PutMapping("/profile")
    public Map<String, Object> profile(@Valid @RequestBody Profile input,
        @RequestHeader(value="Authorization",required=false) String authorization) {
        long id = auth.userId(authorization);
        db.jdbc.update("UPDATE users SET username=? WHERE id=?", input.username().trim(), id);
        return auth.require(authorization);
    }
    @PutMapping("/password")
    @Transactional
    public Map<String, String> password(@Valid @RequestBody ChangePassword input,
        @RequestHeader(value="Authorization",required=false) String authorization) {
        long id = auth.userId(authorization);
        String currentHash = (String) db.one("SELECT password_hash FROM users WHERE id=?", id).get("password_hash");
        if (!auth.passwordMatches(input.currentPassword(), currentHash))
            throw new ApiException(HttpStatus.BAD_REQUEST, "当前密码不正确");
        db.jdbc.update("UPDATE users SET password_hash=? WHERE id=?", auth.passwordHash(input.newPassword()), id);
        db.jdbc.update("DELETE FROM auth_tokens WHERE user_id=?", id);
        return Map.of("message", "密码已更新，请重新登录");
    }
    @PostMapping("/logout")
    public Map<String, String> logout(@RequestHeader(value="Authorization",required=false) String authorization) {
        auth.revoke(authorization); return Map.of("message", "已退出登录");
    }
}

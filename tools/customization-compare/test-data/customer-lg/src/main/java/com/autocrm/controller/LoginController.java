package com.autocrm.controller;

import com.autocrm.service.AuthService;
import com.autocrm.service.LdapService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpSession;

/**
 * 로그인 컨트롤러 - LG 커스터마이징
 * 변경사항: LDAP 통합 인증 추가
 */
@Controller
@RequestMapping("/auth")
public class LoginController {

    @Autowired
    private AuthService authService;

    @Autowired
    private LdapService ldapService;  // ★ 추가: LDAP 서비스

    /**
     * 로그인 페이지
     */
    @GetMapping("/login")
    public String loginPage() {
        return "login";
    }

    /**
     * 로그인 처리 - LDAP 우선 인증
     */
    @PostMapping("/login")
    @ResponseBody
    public Map<String, Object> login(
            @RequestParam String username,
            @RequestParam String password,
            @RequestParam(required = false) String authType,  // ★ 추가: 인증 방식 선택
            HttpSession session) {

        Map<String, Object> result = new HashMap<>();

        try {
            User user = null;

            // ★ 변경: LDAP 우선 인증 (LG 임직원)
            if ("ldap".equals(authType) || authType == null) {
                user = ldapService.authenticateLdap(username, password);

                if (user != null) {
                    // LDAP 인증 성공 시 부서/직급 정보 자동 동기화
                    authService.syncUserFromLdap(user);
                    result.put("authMethod", "LDAP");
                }
            }

            // LDAP 실패 시 DB 인증 (외부 파트너용)
            if (user == null && "database".equals(authType)) {
                user = authService.authenticate(username, password);
                if (user != null) {
                    result.put("authMethod", "DATABASE");
                }
            }

            if (user != null) {
                session.setAttribute("user", user);
                result.put("success", true);
                result.put("message", "로그인 성공");
                result.put("department", user.getDepartment());  // ★ 추가: 부서 정보
                result.put("position", user.getPosition());      // ★ 추가: 직급 정보
            } else {
                result.put("success", false);
                result.put("message", "아이디 또는 비밀번호가 올바르지 않습니다.");
            }

        } catch (Exception e) {
            result.put("success", false);
            result.put("message", "로그인 처리 중 오류가 발생했습니다.");
            log.error("Login error", e);
        }

        return result;
    }

    /**
     * 로그아웃
     */
    @PostMapping("/logout")
    @ResponseBody
    public Map<String, Object> logout(HttpSession session) {
        session.invalidate();
        return Collections.singletonMap("success", true);
    }
}

package com.autocrm.controller;

import com.autocrm.service.AuthService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpSession;

/**
 * 로그인 컨트롤러 - Base 버전
 */
@Controller
@RequestMapping("/auth")
public class LoginController {

    @Autowired
    private AuthService authService;

    /**
     * 로그인 페이지
     */
    @GetMapping("/login")
    public String loginPage() {
        return "login";
    }

    /**
     * 로그인 처리 - 기본 인증
     */
    @PostMapping("/login")
    @ResponseBody
    public Map<String, Object> login(
            @RequestParam String username,
            @RequestParam String password,
            HttpSession session) {

        Map<String, Object> result = new HashMap<>();

        try {
            // 기본 DB 인증
            User user = authService.authenticate(username, password);

            if (user != null) {
                session.setAttribute("user", user);
                result.put("success", true);
                result.put("message", "로그인 성공");
            } else {
                result.put("success", false);
                result.put("message", "아이디 또는 비밀번호가 올바르지 않습니다.");
            }

        } catch (Exception e) {
            result.put("success", false);
            result.put("message", "로그인 처리 중 오류가 발생했습니다.");
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

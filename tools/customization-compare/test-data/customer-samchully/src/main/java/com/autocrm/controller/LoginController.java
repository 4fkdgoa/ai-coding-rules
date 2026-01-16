package com.autocrm.controller;

import com.autocrm.service.AuthService;
import com.autocrm.service.OtpService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import javax.servlet.http.HttpSession;

/**
 * 로그인 컨트롤러 - 삼천리 커스터마이징
 * 변경사항: OTP 2단계 인증 추가
 */
@Controller
@RequestMapping("/auth")
public class LoginController {

    @Autowired
    private AuthService authService;

    @Autowired
    private OtpService otpService;  // ★ 추가: OTP 서비스

    /**
     * 로그인 페이지
     */
    @GetMapping("/login")
    public String loginPage() {
        return "login";
    }

    /**
     * 1단계: ID/PW 인증
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
                // ★ 변경: OTP 발송 후 대기 상태로 설정
                String otpToken = otpService.generateOtp(user.getPhone());
                session.setAttribute("pending_user", user);
                session.setAttribute("otp_token", otpToken);

                result.put("success", true);
                result.put("requireOtp", true);  // ★ 추가: OTP 필요 플래그
                result.put("message", "OTP가 발송되었습니다. 인증번호를 입력하세요.");
                result.put("phone", maskPhone(user.getPhone()));
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
     * 2단계: OTP 인증 (★ 신규 추가)
     */
    @PostMapping("/verify-otp")
    @ResponseBody
    public Map<String, Object> verifyOtp(
            @RequestParam String otpCode,
            HttpSession session) {

        Map<String, Object> result = new HashMap<>();

        try {
            User pendingUser = (User) session.getAttribute("pending_user");
            String otpToken = (String) session.getAttribute("otp_token");

            if (pendingUser == null || otpToken == null) {
                result.put("success", false);
                result.put("message", "세션이 만료되었습니다. 다시 로그인하세요.");
                return result;
            }

            // OTP 검증
            if (otpService.verifyOtp(otpToken, otpCode)) {
                session.setAttribute("user", pendingUser);
                session.removeAttribute("pending_user");
                session.removeAttribute("otp_token");

                result.put("success", true);
                result.put("message", "로그인 성공");
            } else {
                result.put("success", false);
                result.put("message", "OTP 인증번호가 올바르지 않습니다.");
            }

        } catch (Exception e) {
            result.put("success", false);
            result.put("message", "OTP 인증 처리 중 오류가 발생했습니다.");
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

    // ★ 추가: 전화번호 마스킹
    private String maskPhone(String phone) {
        if (phone == null || phone.length() < 4) {
            return phone;
        }
        return phone.substring(0, phone.length() - 4) + "****";
    }
}

package com.autocrm.service;

import com.autocrm.mapper.UserMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

/**
 * 인증 서비스 - Base 버전
 */
@Service
public class AuthService {

    @Autowired
    private UserMapper userMapper;

    /**
     * 사용자 인증 - 기본 DB 방식
     */
    public User authenticate(String username, String password) {
        User user = userMapper.findByUsername(username);

        if (user == null) {
            return null;
        }

        // 비밀번호 검증 (실제로는 BCrypt 등 사용)
        if (user.getPassword().equals(password)) {
            return user;
        }

        return null;
    }

    /**
     * 사용자 조회
     */
    public User getUserById(Long userId) {
        return userMapper.findById(userId);
    }
}

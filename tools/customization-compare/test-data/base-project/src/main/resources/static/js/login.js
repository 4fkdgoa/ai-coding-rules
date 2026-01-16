/**
 * 로그인 화면 - Base 버전
 */
$(document).ready(function() {

    // 로그인 폼 제출
    $('#loginForm').on('submit', function(e) {
        e.preventDefault();

        var username = $('#username').val();
        var password = $('#password').val();

        if (!username || !password) {
            alert('아이디와 비밀번호를 입력하세요.');
            return;
        }

        // 기본 로그인 처리
        $.ajax({
            url: '/auth/login',
            type: 'POST',
            data: {
                username: username,
                password: password
            },
            success: function(response) {
                if (response.success) {
                    alert('로그인 성공!');
                    window.location.href = '/dashboard';
                } else {
                    alert(response.message);
                }
            },
            error: function() {
                alert('로그인 처리 중 오류가 발생했습니다.');
            }
        });
    });
});

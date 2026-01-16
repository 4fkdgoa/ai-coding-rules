/**
 * 로그인 화면 - 삼천리 커스터마이징
 * 변경사항: OTP 2단계 인증 UI 추가
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

        // 1단계: ID/PW 인증
        $.ajax({
            url: '/auth/login',
            type: 'POST',
            data: {
                username: username,
                password: password
            },
            success: function(response) {
                if (response.success && response.requireOtp) {
                    // ★ 추가: OTP 인증 단계로 전환
                    showOtpForm(response.phone);
                } else if (response.success) {
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

    // ★ 신규 추가: OTP 폼 표시
    function showOtpForm(maskedPhone) {
        $('#loginForm').hide();
        $('#otpForm').show();
        $('#phoneNumber').text(maskedPhone);
        $('#otpCode').focus();
    }

    // ★ 신규 추가: OTP 인증 제출
    $('#otpForm').on('submit', function(e) {
        e.preventDefault();

        var otpCode = $('#otpCode').val();

        if (!otpCode || otpCode.length !== 6) {
            alert('6자리 인증번호를 입력하세요.');
            return;
        }

        $.ajax({
            url: '/auth/verify-otp',
            type: 'POST',
            data: {
                otpCode: otpCode
            },
            success: function(response) {
                if (response.success) {
                    alert('인증 성공! 로그인되었습니다.');
                    window.location.href = '/dashboard';
                } else {
                    alert(response.message);
                    $('#otpCode').val('').focus();
                }
            },
            error: function() {
                alert('OTP 인증 처리 중 오류가 발생했습니다.');
            }
        });
    });

    // ★ 신규 추가: OTP 재발송
    $('#resendOtp').on('click', function() {
        $.ajax({
            url: '/auth/resend-otp',
            type: 'POST',
            success: function(response) {
                if (response.success) {
                    alert('인증번호가 재발송되었습니다.');
                } else {
                    alert(response.message);
                }
            }
        });
    });
});

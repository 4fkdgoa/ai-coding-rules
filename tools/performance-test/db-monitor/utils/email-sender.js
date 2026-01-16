/**
 * DB 알림 이메일 발송
 * nodemailer 사용
 */

const nodemailer = require('nodemailer');

class EmailSender {
    constructor(config) {
        this.config = config;
        this.enabled = config.enabled !== false;
        this.transporter = null;
        this.lastSentTime = {};
        this.throttleMs = (config.throttleMinutes || 10) * 60 * 1000;

        if (this.enabled) {
            this.createTransporter();
        }
    }

    /**
     * SMTP Transporter 생성
     */
    createTransporter() {
        try {
            this.transporter = nodemailer.createTransporter(this.config.smtp);
            console.log('✅ 이메일 발송 설정 완료');
        } catch (error) {
            console.error('❌ 이메일 발송 설정 실패:', error.message);
            this.enabled = false;
        }
    }

    /**
     * 이메일 발송 (throttling 적용)
     */
    async sendAlert(alert) {
        if (!this.enabled) {
            console.log('ℹ️  이메일 발송 비활성화됨');
            return false;
        }

        // 발송 레벨 체크
        const sendOnLevels = this.config.sendOnLevels || ['critical', 'warning'];
        if (!sendOnLevels.includes(alert.level)) {
            console.log(`ℹ️  이메일 발송 건너뜀 (레벨: ${alert.level})`);
            return false;
        }

        // Throttling 체크
        const throttleKey = `${alert.type}_${alert.level}`;
        const now = Date.now();
        const lastSent = this.lastSentTime[throttleKey] || 0;

        if (now - lastSent < this.throttleMs) {
            const waitMinutes = Math.ceil((this.throttleMs - (now - lastSent)) / 60000);
            console.log(`⏱️  이메일 발송 대기 중 (${waitMinutes}분 후 재시도 가능)`);
            return false;
        }

        // 이메일 발송
        try {
            const html = this.generateHtml(alert);
            const subject = this.generateSubject(alert);

            const mailOptions = {
                from: this.config.from,
                to: this.config.to.join(', '),
                subject: subject,
                html: html
            };

            const info = await this.transporter.sendMail(mailOptions);

            // 발송 시간 기록
            this.lastSentTime[throttleKey] = now;

            console.log(`✅ 이메일 발송 완료: ${info.messageId}`);
            return true;

        } catch (error) {
            console.error('❌ 이메일 발송 실패:', error.message);
            return false;
        }
    }

    /**
     * 이메일 제목 생성
     */
    generateSubject(alert) {
        const levelEmoji = {
            critical: '🚨',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const emoji = levelEmoji[alert.level] || '📊';
        const levelText = alert.level.toUpperCase();
        const typeText = alert.type.replace(/_/g, ' ').toUpperCase();

        return `${emoji} [${levelText}] DB Alert - ${typeText}`;
    }

    /**
     * 이메일 HTML 생성
     */
    generateHtml(alert) {
        const levelColor = {
            critical: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };

        const color = levelColor[alert.level] || '#6c757d';

        return `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 800px; margin: 0 auto; padding: 20px; }
        .header { background-color: ${color}; color: white; padding: 20px; border-radius: 5px 5px 0 0; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { background-color: #f8f9fa; padding: 20px; border: 1px solid #dee2e6; }
        .alert-info { background-color: white; padding: 15px; margin: 10px 0; border-left: 4px solid ${color}; }
        .metric { display: inline-block; margin: 10px 20px 10px 0; }
        .metric-label { font-weight: bold; color: #6c757d; }
        .metric-value { font-size: 18px; color: ${color}; font-weight: bold; }
        .query-box { background-color: #f1f3f5; padding: 15px; margin: 10px 0; border-radius: 5px; font-family: monospace; font-size: 12px; overflow-x: auto; }
        .footer { background-color: #e9ecef; padding: 15px; text-align: center; border-radius: 0 0 5px 5px; font-size: 12px; color: #6c757d; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 8px; text-align: left; border-bottom: 1px solid #dee2e6; }
        th { background-color: #e9ecef; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>${this.generateSubject(alert)}</h1>
            <p style="margin: 5px 0 0 0;">${alert.message}</p>
        </div>

        <div class="content">
            <div class="alert-info">
                <h2 style="margin-top: 0;">알림 정보</h2>
                <table>
                    <tr>
                        <th>발생 시각</th>
                        <td>${new Date(alert.timestamp).toLocaleString('ko-KR')}</td>
                    </tr>
                    <tr>
                        <th>알림 레벨</th>
                        <td><strong style="color: ${color}">${alert.level.toUpperCase()}</strong></td>
                    </tr>
                    <tr>
                        <th>알림 유형</th>
                        <td>${alert.type.replace(/_/g, ' ')}</td>
                    </tr>
                    <tr>
                        <th>세션 ID</th>
                        <td>${alert.sessionId || 'N/A'}</td>
                    </tr>
                    <tr>
                        <th>데이터베이스</th>
                        <td>${alert.database || 'N/A'}</td>
                    </tr>
                </table>
            </div>

            <div class="alert-info">
                <h2 style="margin-top: 0;">성능 지표</h2>
                <div class="metric">
                    <div class="metric-label">실행 시간</div>
                    <div class="metric-value">${alert.executionTimeMs ? alert.executionTimeMs.toLocaleString() + ' ms' : 'N/A'}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">CPU 시간</div>
                    <div class="metric-value">${alert.cpuTimeMs ? alert.cpuTimeMs.toLocaleString() + ' ms' : 'N/A'}</div>
                </div>
                <div class="metric">
                    <div class="metric-label">논리적 읽기</div>
                    <div class="metric-value">${alert.logicalReads ? alert.logicalReads.toLocaleString() : 'N/A'}</div>
                </div>
                ${alert.blockingSessionId ? `
                <div class="metric">
                    <div class="metric-label">차단 세션</div>
                    <div class="metric-value">${alert.blockingSessionId}</div>
                </div>
                ` : ''}
                ${alert.waitType ? `
                <div class="metric">
                    <div class="metric-label">대기 유형</div>
                    <div class="metric-value">${alert.waitType}</div>
                </div>
                ` : ''}
            </div>

            ${alert.queryText ? `
            <div class="alert-info">
                <h2 style="margin-top: 0;">쿼리</h2>
                <div class="query-box">${this.escapeHtml(alert.queryText)}</div>
            </div>
            ` : ''}

            ${alert.executionPlan ? `
            <div class="alert-info">
                <h2 style="margin-top: 0;">실행 계획 요약</h2>
                <ul>
                    ${alert.executionPlan.tableScans > 0 ? `<li>⚠️ Table Scan: ${alert.executionPlan.tableScans}개 (인덱스 미사용)</li>` : ''}
                    ${alert.executionPlan.indexScans > 0 ? `<li>⚠️ Index Scan: ${alert.executionPlan.indexScans}개 (전체 스캔)</li>` : ''}
                    ${alert.executionPlan.indexSeeks > 0 ? `<li>✅ Index Seek: ${alert.executionPlan.indexSeeks}개 (효율적)</li>` : ''}
                </ul>
            </div>
            ` : ''}

            <div class="alert-info">
                <h2 style="margin-top: 0;">권장 조치</h2>
                <ul>
                    ${this.generateRecommendations(alert).map(rec => `<li>${rec}</li>`).join('')}
                </ul>
            </div>
        </div>

        <div class="footer">
            <p>DB Monitor v1.0 - 자동 생성된 알림</p>
            <p>이 알림은 ${this.config.throttleMinutes || 10}분마다 최대 1회 발송됩니다.</p>
        </div>
    </div>
</body>
</html>
        `;
    }

    /**
     * HTML 이스케이프
     */
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }

    /**
     * 권장 조치 생성
     */
    generateRecommendations(alert) {
        const recommendations = [];

        if (alert.executionTimeMs > 3000) {
            recommendations.push('쿼리 실행 시간이 매우 깁니다. WHERE 절 최적화 및 인덱스 추가를 검토하세요.');
        }

        if (alert.logicalReads > 50000) {
            recommendations.push('논리적 읽기가 과다합니다. 불필요한 JOIN 제거 및 인덱스 최적화가 필요합니다.');
        }

        if (alert.blockingSessionId) {
            recommendations.push('다른 세션을 차단하고 있습니다. 트랜잭션 길이를 단축하고 잠금을 최소화하세요.');
        }

        if (alert.executionPlan && alert.executionPlan.tableScans > 0) {
            recommendations.push('Table Scan이 발생하고 있습니다. WHERE 절에 사용되는 컬럼에 인덱스를 추가하세요.');
        }

        if (alert.waitType) {
            if (alert.waitType.includes('PAGEIOLATCH')) {
                recommendations.push('디스크 I/O 대기가 감지되었습니다. 스토리지 성능을 확인하세요.');
            } else if (alert.waitType.includes('CXPACKET')) {
                recommendations.push('병렬 처리 대기가 감지되었습니다. MAXDOP 설정을 검토하세요.');
            }
        }

        if (recommendations.length === 0) {
            recommendations.push('DBA에게 상세 분석을 요청하세요.');
        }

        return recommendations;
    }

    /**
     * 테스트 이메일 발송
     */
    async sendTestEmail() {
        const testAlert = {
            timestamp: new Date().toISOString(),
            level: 'info',
            type: 'test',
            message: '이메일 발송 테스트',
            sessionId: 'TEST',
            database: 'AutoCRM_Samchully',
            executionTimeMs: 1234,
            cpuTimeMs: 567,
            logicalReads: 8901,
            queryText: 'SELECT * FROM STOCK WHERE VIN_NO = \'TEST123\'',
            executionPlan: {
                tableScans: 0,
                indexScans: 0,
                indexSeeks: 1
            }
        };

        return await this.sendAlert(testAlert);
    }
}

module.exports = EmailSender;

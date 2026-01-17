/**
 * Webhook 알림 발송
 * Google Chat, Slack, Discord, MS Teams 등
 */

const https = require('https');
const http = require('http');

class WebhookSender {
    constructor(config) {
        this.config = config;
        this.enabled = config.enabled !== false;
        this.webhooks = config.webhooks || [];
        this.lastSentTime = {};
        this.throttleMs = (config.throttleMinutes || 10) * 60 * 1000;
    }

    /**
     * Webhook 알림 발송 (throttling 적용)
     */
    async sendAlert(alert) {
        if (!this.enabled || this.webhooks.length === 0) {
            console.log('ℹ️  Webhook 발송 비활성화됨');
            return false;
        }

        // 발송 레벨 체크
        const sendOnLevels = this.config.sendOnLevels || ['critical', 'warning'];
        if (!sendOnLevels.includes(alert.level)) {
            console.log(`ℹ️  Webhook 발송 건너뜀 (레벨: ${alert.level})`);
            return false;
        }

        // Throttling 체크
        const throttleKey = `${alert.type}_${alert.level}`;
        const now = Date.now();
        const lastSent = this.lastSentTime[throttleKey] || 0;

        if (now - lastSent < this.throttleMs) {
            const waitMinutes = Math.ceil((this.throttleMs - (now - lastSent)) / 60000);
            console.log(`⏱️  Webhook 발송 대기 중 (${waitMinutes}분 후 재시도 가능)`);
            return false;
        }

        // 모든 Webhook에 발송
        const results = await Promise.all(
            this.webhooks.map(webhook => this.sendToWebhook(webhook, alert))
        );

        // 하나라도 성공하면 발송 시간 기록
        if (results.some(r => r)) {
            this.lastSentTime[throttleKey] = now;
            return true;
        }

        return false;
    }

    /**
     * 개별 Webhook 발송
     */
    async sendToWebhook(webhook, alert) {
        const payload = this.buildPayload(webhook.type, alert);

        try {
            const response = await this.sendHttpRequest(webhook.url, payload);

            console.log(`✅ Webhook 발송 완료: ${webhook.type} (${webhook.name || ''})`);
            return true;

        } catch (error) {
            console.error(`❌ Webhook 발송 실패: ${webhook.type}`, error.message);
            return false;
        }
    }

    /**
     * Webhook 타입별 페이로드 생성
     */
    buildPayload(type, alert) {
        switch (type.toLowerCase()) {
            case 'google-chat':
            case 'googlechat':
                return this.buildGoogleChatPayload(alert);

            case 'slack':
                return this.buildSlackPayload(alert);

            case 'discord':
                return this.buildDiscordPayload(alert);

            case 'teams':
            case 'msteams':
                return this.buildTeamsPayload(alert);

            case 'generic':
            default:
                return this.buildGenericPayload(alert);
        }
    }

    /**
     * Google Chat 페이로드
     */
    buildGoogleChatPayload(alert) {
        const levelEmoji = {
            critical: '🚨',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const emoji = levelEmoji[alert.level] || '📊';
        const color = this.getLevelColor(alert.level);

        const cards = {
            cards: [
                {
                    header: {
                        title: `${emoji} DB Alert - ${alert.level.toUpperCase()}`,
                        subtitle: alert.message,
                        imageUrl: 'https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png'
                    },
                    sections: [
                        {
                            widgets: [
                                {
                                    keyValue: {
                                        topLabel: '발생 시각',
                                        content: new Date(alert.timestamp).toLocaleString('ko-KR')
                                    }
                                },
                                {
                                    keyValue: {
                                        topLabel: '알림 유형',
                                        content: alert.type.replace(/_/g, ' ').toUpperCase()
                                    }
                                },
                                {
                                    keyValue: {
                                        topLabel: '세션 ID',
                                        content: String(alert.sessionId || 'N/A')
                                    }
                                },
                                {
                                    keyValue: {
                                        topLabel: '데이터베이스',
                                        content: alert.database || 'N/A'
                                    }
                                }
                            ]
                        },
                        {
                            header: '성능 지표',
                            widgets: [
                                {
                                    keyValue: {
                                        topLabel: '실행 시간',
                                        content: alert.executionTimeMs ? `${alert.executionTimeMs.toLocaleString()} ms` : 'N/A',
                                        contentMultiline: false
                                    }
                                },
                                {
                                    keyValue: {
                                        topLabel: 'CPU 시간',
                                        content: alert.cpuTimeMs ? `${alert.cpuTimeMs.toLocaleString()} ms` : 'N/A'
                                    }
                                },
                                {
                                    keyValue: {
                                        topLabel: '논리적 읽기',
                                        content: alert.logicalReads ? alert.logicalReads.toLocaleString() : 'N/A'
                                    }
                                }
                            ]
                        }
                    ]
                }
            ]
        };

        if (alert.queryText) {
            cards.cards[0].sections.push({
                header: '쿼리',
                widgets: [
                    {
                        textParagraph: {
                            text: `<font face="monospace">${this.truncate(alert.queryText, 500)}</font>`
                        }
                    }
                ]
            });
        }

        return cards;
    }

    /**
     * Slack 페이로드
     */
    buildSlackPayload(alert) {
        const levelEmoji = {
            critical: ':rotating_light:',
            warning: ':warning:',
            info: ':information_source:'
        };

        const emoji = levelEmoji[alert.level] || ':bell:';
        const color = this.getLevelColor(alert.level);

        return {
            text: `${emoji} DB Alert - ${alert.level.toUpperCase()}`,
            attachments: [
                {
                    color: color,
                    title: alert.message,
                    fields: [
                        {
                            title: '발생 시각',
                            value: new Date(alert.timestamp).toLocaleString('ko-KR'),
                            short: true
                        },
                        {
                            title: '알림 유형',
                            value: alert.type.replace(/_/g, ' ').toUpperCase(),
                            short: true
                        },
                        {
                            title: '세션 ID',
                            value: String(alert.sessionId || 'N/A'),
                            short: true
                        },
                        {
                            title: '데이터베이스',
                            value: alert.database || 'N/A',
                            short: true
                        },
                        {
                            title: '실행 시간',
                            value: alert.executionTimeMs ? `${alert.executionTimeMs.toLocaleString()} ms` : 'N/A',
                            short: true
                        },
                        {
                            title: 'CPU 시간',
                            value: alert.cpuTimeMs ? `${alert.cpuTimeMs.toLocaleString()} ms` : 'N/A',
                            short: true
                        }
                    ],
                    footer: 'DB Monitor',
                    ts: Math.floor(new Date(alert.timestamp).getTime() / 1000)
                }
            ]
        };
    }

    /**
     * Discord 페이로드
     */
    buildDiscordPayload(alert) {
        const levelEmoji = {
            critical: '🚨',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const emoji = levelEmoji[alert.level] || '📊';
        const color = parseInt(this.getLevelColor(alert.level).replace('#', ''), 16);

        const embed = {
            embeds: [
                {
                    title: `${emoji} DB Alert - ${alert.level.toUpperCase()}`,
                    description: alert.message,
                    color: color,
                    fields: [
                        {
                            name: '발생 시각',
                            value: new Date(alert.timestamp).toLocaleString('ko-KR'),
                            inline: true
                        },
                        {
                            name: '알림 유형',
                            value: alert.type.replace(/_/g, ' ').toUpperCase(),
                            inline: true
                        },
                        {
                            name: '세션 ID',
                            value: String(alert.sessionId || 'N/A'),
                            inline: true
                        },
                        {
                            name: '데이터베이스',
                            value: alert.database || 'N/A',
                            inline: true
                        },
                        {
                            name: '실행 시간',
                            value: alert.executionTimeMs ? `${alert.executionTimeMs.toLocaleString()} ms` : 'N/A',
                            inline: true
                        },
                        {
                            name: 'CPU 시간',
                            value: alert.cpuTimeMs ? `${alert.cpuTimeMs.toLocaleString()} ms` : 'N/A',
                            inline: true
                        }
                    ],
                    timestamp: alert.timestamp,
                    footer: {
                        text: 'DB Monitor v1.0'
                    }
                }
            ]
        };

        if (alert.queryText) {
            embed.embeds[0].fields.push({
                name: '쿼리',
                value: `\`\`\`sql\n${this.truncate(alert.queryText, 500)}\n\`\`\``,
                inline: false
            });
        }

        return embed;
    }

    /**
     * MS Teams 페이로드
     */
    buildTeamsPayload(alert) {
        const levelEmoji = {
            critical: '🚨',
            warning: '⚠️',
            info: 'ℹ️'
        };

        const emoji = levelEmoji[alert.level] || '📊';
        const color = this.getLevelColor(alert.level);

        return {
            '@type': 'MessageCard',
            '@context': 'https://schema.org/extensions',
            summary: `DB Alert - ${alert.level.toUpperCase()}`,
            themeColor: color,
            title: `${emoji} DB Alert - ${alert.level.toUpperCase()}`,
            sections: [
                {
                    activityTitle: alert.message,
                    activitySubtitle: new Date(alert.timestamp).toLocaleString('ko-KR'),
                    facts: [
                        {
                            name: '알림 유형',
                            value: alert.type.replace(/_/g, ' ').toUpperCase()
                        },
                        {
                            name: '세션 ID',
                            value: String(alert.sessionId || 'N/A')
                        },
                        {
                            name: '데이터베이스',
                            value: alert.database || 'N/A'
                        },
                        {
                            name: '실행 시간',
                            value: alert.executionTimeMs ? `${alert.executionTimeMs.toLocaleString()} ms` : 'N/A'
                        },
                        {
                            name: 'CPU 시간',
                            value: alert.cpuTimeMs ? `${alert.cpuTimeMs.toLocaleString()} ms` : 'N/A'
                        }
                    ]
                }
            ]
        };
    }

    /**
     * 범용 Webhook 페이로드
     */
    buildGenericPayload(alert) {
        return {
            timestamp: alert.timestamp,
            level: alert.level,
            type: alert.type,
            message: alert.message,
            sessionId: alert.sessionId,
            database: alert.database,
            executionTimeMs: alert.executionTimeMs,
            cpuTimeMs: alert.cpuTimeMs,
            logicalReads: alert.logicalReads,
            blockingSessionId: alert.blockingSessionId,
            waitType: alert.waitType,
            queryText: this.truncate(alert.queryText, 1000)
        };
    }

    /**
     * HTTP 요청 발송
     */
    sendHttpRequest(url, payload) {
        return new Promise((resolve, reject) => {
            const urlObj = new URL(url);
            const protocol = urlObj.protocol === 'https:' ? https : http;

            const options = {
                hostname: urlObj.hostname,
                port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
                path: urlObj.pathname + urlObj.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                }
            };

            const req = protocol.request(options, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve(data);
                    } else {
                        reject(new Error(`HTTP ${res.statusCode}: ${data}`));
                    }
                });
            });

            req.on('error', (error) => {
                reject(error);
            });

            req.write(JSON.stringify(payload));
            req.end();
        });
    }

    /**
     * 레벨별 색상
     */
    getLevelColor(level) {
        const colors = {
            critical: '#dc3545',
            warning: '#ffc107',
            info: '#17a2b8'
        };
        return colors[level] || '#6c757d';
    }

    /**
     * 문자열 자르기
     */
    truncate(text, maxLength) {
        if (!text) return '';
        if (text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }

    /**
     * 테스트 Webhook 발송
     */
    async sendTestMessage() {
        const testAlert = {
            timestamp: new Date().toISOString(),
            level: 'info',
            type: 'test',
            message: 'Webhook 발송 테스트',
            sessionId: 'TEST',
            database: 'AutoCRM_Samchully',
            executionTimeMs: 1234,
            cpuTimeMs: 567,
            logicalReads: 8901,
            queryText: 'SELECT * FROM STOCK WHERE VIN_NO = \'TEST123\''
        };

        return await this.sendAlert(testAlert);
    }
}

module.exports = WebhookSender;

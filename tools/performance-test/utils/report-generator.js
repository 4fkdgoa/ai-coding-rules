/**
 * HTML 리포트 생성기
 */

const fs = require('fs');
const path = require('path');

class ReportGenerator {
    /**
     * HTML 리포트 생성
     */
    static generateHTML(reports) {
        const html = `
<!DOCTYPE html>
<html lang="ko">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>성능 분석 리포트</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #f5f5f5;
            padding: 20px;
        }
        .container {
            max-width: 1400px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
            border-bottom: 3px solid #007bff;
            padding-bottom: 10px;
        }
        .timestamp {
            color: #666;
            margin-bottom: 30px;
        }
        .page-report {
            margin-bottom: 50px;
            border: 1px solid #ddd;
            border-radius: 6px;
            padding: 20px;
        }
        .page-title {
            font-size: 24px;
            color: #007bff;
            margin-bottom: 20px;
        }
        .section {
            margin-bottom: 30px;
        }
        .section-title {
            font-size: 18px;
            color: #333;
            margin-bottom: 15px;
            padding-bottom: 8px;
            border-bottom: 2px solid #eee;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }
        .metric-card {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 6px;
            border-left: 4px solid #007bff;
        }
        .metric-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        .metric-value {
            font-size: 24px;
            font-weight: bold;
            color: #333;
        }
        .metric-unit {
            font-size: 14px;
            color: #999;
            margin-left: 5px;
        }
        .good { border-left-color: #28a745; }
        .warning { border-left-color: #ffc107; }
        .bad { border-left-color: #dc3545; }
        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }
        th, td {
            padding: 12px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }
        th {
            background: #f8f9fa;
            font-weight: 600;
            color: #333;
        }
        tr:hover {
            background: #f8f9fa;
        }
        .status-200 { color: #28a745; font-weight: bold; }
        .status-300 { color: #17a2b8; font-weight: bold; }
        .status-400 { color: #ffc107; font-weight: bold; }
        .status-500 { color: #dc3545; font-weight: bold; }
        .url-cell {
            max-width: 400px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>SDMS 성능 분석 리포트</h1>
        <p class="timestamp">생성 시간: ${new Date().toLocaleString('ko-KR')}</p>

        ${reports.map(report => this.generatePageReport(report)).join('\n')}
    </div>
</body>
</html>
        `;

        return html;
    }

    /**
     * 페이지별 리포트 섹션 생성
     */
    static generatePageReport(report) {
        const nav = report.navigation;
        const vitals = report.webVitals;
        const api = report.api;

        return `
        <div class="page-report">
            <h2 class="page-title">${report.pageName}</h2>

            <!-- 네비게이션 메트릭 -->
            ${nav ? `
            <div class="section">
                <h3 class="section-title">페이지 로딩 성능</h3>
                <div class="metrics-grid">
                    ${this.createMetricCard('TTFB', nav.ttfb, 'ms', nav.ttfb < 500 ? 'good' : nav.ttfb < 1000 ? 'warning' : 'bad')}
                    ${this.createMetricCard('DNS', nav.dns, 'ms', 'good')}
                    ${this.createMetricCard('TCP', nav.tcp, 'ms', 'good')}
                    ${this.createMetricCard('요청 시간', nav.request, 'ms', nav.request < 300 ? 'good' : 'warning')}
                    ${this.createMetricCard('응답 시간', nav.response, 'ms', nav.response < 500 ? 'good' : 'warning')}
                    ${this.createMetricCard('DOM 로드', nav.domContentLoaded, 'ms', nav.domContentLoaded < 1000 ? 'good' : 'warning')}
                    ${this.createMetricCard('전체 로드', nav.totalTime, 'ms', nav.totalTime < 3000 ? 'good' : nav.totalTime < 5000 ? 'warning' : 'bad')}
                </div>
            </div>
            ` : ''}

            <!-- Web Vitals -->
            ${vitals && Object.keys(vitals).length > 0 ? `
            <div class="section">
                <h3 class="section-title">Web Vitals</h3>
                <div class="metrics-grid">
                    ${vitals.lcp ? this.createMetricCard('LCP', vitals.lcp, 'ms', vitals.lcp < 2500 ? 'good' : vitals.lcp < 4000 ? 'warning' : 'bad') : ''}
                    ${vitals.fcp ? this.createMetricCard('FCP', vitals.fcp, 'ms', vitals.fcp < 1800 ? 'good' : vitals.fcp < 3000 ? 'warning' : 'bad') : ''}
                    ${vitals.cls !== undefined ? this.createMetricCard('CLS', vitals.cls, '', vitals.cls < 0.1 ? 'good' : vitals.cls < 0.25 ? 'warning' : 'bad') : ''}
                </div>
            </div>
            ` : ''}

            <!-- API 통계 -->
            ${api.statistics ? `
            <div class="section">
                <h3 class="section-title">API 호출 통계</h3>
                <div class="metrics-grid">
                    ${this.createMetricCard('총 API 호출', api.statistics.count, '개', 'good')}
                    ${this.createMetricCard('평균 응답', api.statistics.avgDuration, 'ms', api.statistics.avgDuration < 500 ? 'good' : 'warning')}
                    ${this.createMetricCard('최소 응답', api.statistics.minDuration, 'ms', 'good')}
                    ${this.createMetricCard('최대 응답', api.statistics.maxDuration, 'ms', api.statistics.maxDuration < 1000 ? 'good' : 'warning')}
                    ${this.createMetricCard('P50', api.statistics.p50, 'ms', api.statistics.p50 < 500 ? 'good' : 'warning')}
                    ${this.createMetricCard('P95', api.statistics.p95, 'ms', api.statistics.p95 < 1000 ? 'good' : 'warning')}
                </div>
            </div>
            ` : ''}

            <!-- API 상세 -->
            ${api.calls && api.calls.length > 0 ? `
            <div class="section">
                <h3 class="section-title">API 호출 상세</h3>
                <table>
                    <thead>
                        <tr>
                            <th>URL</th>
                            <th>메서드</th>
                            <th>상태</th>
                            <th>응답시간</th>
                            <th>크기</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${api.calls.map(call => `
                        <tr>
                            <td class="url-cell" title="${call.url}">${call.url}</td>
                            <td>${call.method}</td>
                            <td class="status-${Math.floor(call.status / 100)}00">${call.status}</td>
                            <td>${call.duration}ms</td>
                            <td>${this.formatBytes(call.size)}</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ` : ''}

            <!-- 리소스 통계 -->
            ${report.resources ? `
            <div class="section">
                <h3 class="section-title">리소스 타입별 통계</h3>
                <table>
                    <thead>
                        <tr>
                            <th>타입</th>
                            <th>개수</th>
                            <th>총 크기</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${Object.entries(report.resources).map(([type, stat]) => `
                        <tr>
                            <td>${type}</td>
                            <td>${stat.count}</td>
                            <td>${this.formatBytes(stat.totalSize)}</td>
                        </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ` : ''}
        </div>
        `;
    }

    /**
     * 메트릭 카드 생성
     */
    static createMetricCard(label, value, unit, status = 'good') {
        return `
        <div class="metric-card ${status}">
            <div class="metric-label">${label}</div>
            <div class="metric-value">
                ${value}
                <span class="metric-unit">${unit}</span>
            </div>
        </div>
        `;
    }

    /**
     * 바이트를 읽기 쉬운 형식으로 변환
     */
    static formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }

    /**
     * 리포트 파일 저장
     */
    static save(reports, outputDir = 'reports') {
        const html = this.generateHTML(reports);

        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `performance-report-${timestamp}.html`;
        const filepath = path.join(outputDir, filename);

        fs.writeFileSync(filepath, html, 'utf-8');

        // JSON 리포트도 저장
        const jsonFilename = `performance-data-${timestamp}.json`;
        const jsonFilepath = path.join(outputDir, jsonFilename);
        fs.writeFileSync(jsonFilepath, JSON.stringify(reports, null, 2), 'utf-8');

        return {
            html: filepath,
            json: jsonFilepath
        };
    }
}

module.exports = ReportGenerator;

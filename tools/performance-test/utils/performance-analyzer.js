/**
 * 성능 분석 유틸리티
 */

class PerformanceAnalyzer {
    constructor() {
        this.requests = [];
        this.responses = [];
        this.apiCalls = [];
    }

    /**
     * Playwright 페이지에 성능 추적 리스너 등록
     */
    attachToPage(page) {
        // 요청 추적
        page.on('request', request => {
            this.requests.push({
                url: request.url(),
                method: request.method(),
                timestamp: Date.now(),
                resourceType: request.resourceType(),
                headers: request.headers()
            });
        });

        // 응답 추적
        page.on('response', async response => {
            const request = response.request();
            const timing = request.timing();

            const responseData = {
                url: response.url(),
                status: response.status(),
                method: request.method(),
                resourceType: request.resourceType(),
                timestamp: Date.now(),
                headers: response.headers(),
                timing: timing,
                size: 0
            };

            // 응답 크기 계산
            try {
                const body = await response.body();
                responseData.size = body.length;
            } catch (e) {
                // 일부 리소스는 body를 읽을 수 없음
            }

            this.responses.push(responseData);

            // API 호출만 별도 추적 (.do, .crm, /api/ 등)
            if (this.isApiCall(response.url())) {
                this.apiCalls.push({
                    ...responseData,
                    duration: timing ? timing.responseEnd : 0
                });
            }
        });
    }

    /**
     * API 호출 여부 판단
     */
    isApiCall(url) {
        return url.includes('.do') ||
               url.includes('.crm') ||
               url.includes('/api/') ||
               url.includes('.json');
    }

    /**
     * 페이지 로딩 성능 메트릭 수집
     */
    async getNavigationMetrics(page) {
        return await page.evaluate(() => {
            const perfData = performance.getEntriesByType('navigation')[0];
            if (!perfData) return null;

            return {
                // DNS 조회 시간
                dns: Math.round(perfData.domainLookupEnd - perfData.domainLookupStart),
                // TCP 연결 시간
                tcp: Math.round(perfData.connectEnd - perfData.connectStart),
                // 요청 시간 (서버까지)
                request: Math.round(perfData.responseStart - perfData.requestStart),
                // 응답 시간 (서버에서 응답 받는 시간)
                response: Math.round(perfData.responseEnd - perfData.responseStart),
                // DOM 로딩 시간
                domContentLoaded: Math.round(perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart),
                // 전체 로드 시간
                load: Math.round(perfData.loadEventEnd - perfData.loadEventStart),
                // TTFB (Time to First Byte)
                ttfb: Math.round(perfData.responseStart - perfData.requestStart),
                // 전체 페이지 로드 시간
                totalTime: Math.round(perfData.loadEventEnd - perfData.fetchStart)
            };
        });
    }

    /**
     * Web Vitals 수집 (LCP, FID, CLS)
     */
    async getWebVitals(page) {
        try {
            return await page.evaluate(() => {
                return new Promise((resolve) => {
                    const vitals = {};

                    // LCP (Largest Contentful Paint)
                    try {
                        new PerformanceObserver((list) => {
                            const entries = list.getEntries();
                            if (entries.length > 0) {
                                const lastEntry = entries[entries.length - 1];
                                vitals.lcp = Math.round(lastEntry.renderTime || lastEntry.loadTime);
                            }
                        }).observe({ entryTypes: ['largest-contentful-paint'] });
                    } catch (e) {
                        // LCP 미지원
                    }

                    // CLS (Cumulative Layout Shift)
                    try {
                        let clsScore = 0;
                        new PerformanceObserver((list) => {
                            for (const entry of list.getEntries()) {
                                if (!entry.hadRecentInput) {
                                    clsScore += entry.value;
                                }
                            }
                            vitals.cls = Math.round(clsScore * 1000) / 1000;
                        }).observe({ entryTypes: ['layout-shift'] });
                    } catch (e) {
                        // CLS 미지원
                    }

                    // FCP (First Contentful Paint)
                    try {
                        new PerformanceObserver((list) => {
                            const entries = list.getEntries();
                            if (entries.length > 0) {
                                vitals.fcp = Math.round(entries[0].startTime);
                            }
                        }).observe({ entryTypes: ['paint'] });
                    } catch (e) {
                        // FCP 미지원
                    }

                    // 1초 후 수집 완료 (페이지 전환 전에 빠르게)
                    setTimeout(() => resolve(vitals), 1000);
                });
            });
        } catch (error) {
            // 페이지 전환으로 인한 에러 무시
            return {};
        }
    }

    /**
     * API 호출 통계 계산
     */
    getApiStatistics() {
        if (this.apiCalls.length === 0) {
            return null;
        }

        const durations = this.apiCalls
            .filter(call => call.duration > 0)
            .map(call => call.duration);

        if (durations.length === 0) {
            return null;
        }

        durations.sort((a, b) => a - b);

        return {
            count: this.apiCalls.length,
            avgDuration: Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
            minDuration: Math.round(durations[0]),
            maxDuration: Math.round(durations[durations.length - 1]),
            p50: Math.round(durations[Math.floor(durations.length * 0.5)]),
            p95: Math.round(durations[Math.floor(durations.length * 0.95)]),
            p99: Math.round(durations[Math.floor(durations.length * 0.99)])
        };
    }

    /**
     * 상세 API 호출 목록
     */
    getDetailedApiCalls() {
        return this.apiCalls.map(call => ({
            url: call.url,
            method: call.method,
            status: call.status,
            duration: Math.round(call.duration),
            size: call.size,
            timestamp: new Date(call.timestamp).toISOString()
        }));
    }

    /**
     * 리소스 타입별 통계
     */
    getResourceStatistics() {
        const stats = {};

        this.responses.forEach(res => {
            const type = res.resourceType;
            if (!stats[type]) {
                stats[type] = {
                    count: 0,
                    totalSize: 0
                };
            }
            stats[type].count++;
            stats[type].totalSize += res.size;
        });

        return stats;
    }

    /**
     * 전체 리포트 생성
     */
    async generateReport(page, pageName) {
        const navigation = await this.getNavigationMetrics(page);
        const vitals = await this.getWebVitals(page);
        const apiStats = this.getApiStatistics();
        const resourceStats = this.getResourceStatistics();

        return {
            pageName,
            timestamp: new Date().toISOString(),
            navigation,
            webVitals: vitals,
            api: {
                statistics: apiStats,
                calls: this.getDetailedApiCalls()
            },
            resources: resourceStats,
            summary: {
                totalRequests: this.requests.length,
                totalResponses: this.responses.length,
                totalApiCalls: this.apiCalls.length
            }
        };
    }

    /**
     * 데이터 초기화
     */
    reset() {
        this.requests = [];
        this.responses = [];
        this.apiCalls = [];
    }
}

module.exports = PerformanceAnalyzer;

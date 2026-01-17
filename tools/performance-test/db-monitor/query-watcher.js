/**
 * 특정 쿼리만 지정 모니터링
 * - XML에서 쿼리 추출
 * - 패턴 매칭으로 쿼리 식별
 * - 개별 임계값 설정
 */

const sql = require('mssql');
const fs = require('fs');
const path = require('path');
const xml2js = require('xml2js');

class QueryWatcher {
    constructor(dbPool, config) {
        this.pool = dbPool;
        this.watchList = config.watchQueries || [];
        this.queryMap = new Map(); // 쿼리 텍스트 → 쿼리 이름 매핑
        this.stats = new Map(); // 쿼리별 통계
    }

    /**
     * XML 파일에서 쿼리 추출 (iBatis/MyBatis)
     */
    async loadQueriesFromXML(xmlFilePath) {
        try {
            const xmlContent = fs.readFileSync(xmlFilePath, 'utf-8');
            const parser = new xml2js.Parser();
            const result = await parser.parseStringPromise(xmlContent);

            const queries = [];

            // iBatis/MyBatis XML 파싱
            const sqlMap = result.sqlMap || result.mapper;
            if (!sqlMap) {
                throw new Error('Invalid iBatis/MyBatis XML');
            }

            // <select> 태그 추출
            const selects = sqlMap.select || [];
            for (const select of selects) {
                const queryId = select.$.id;
                const queryText = this.cleanQuery(select._);

                queries.push({
                    name: path.basename(xmlFilePath, '.xml') + '.' + queryId,
                    text: queryText,
                    type: 'select'
                });
            }

            // <update> 태그 추출
            const updates = sqlMap.update || [];
            for (const update of updates) {
                const queryId = update.$.id;
                const queryText = this.cleanQuery(update._);

                queries.push({
                    name: path.basename(xmlFilePath, '.xml') + '.' + queryId,
                    text: queryText,
                    type: 'update'
                });
            }

            // <insert> 태그 추출
            const inserts = sqlMap.insert || [];
            for (const insert of inserts) {
                const queryId = insert.$.id;
                const queryText = this.cleanQuery(insert._);

                queries.push({
                    name: path.basename(xmlFilePath, '.xml') + '.' + queryId,
                    text: queryText,
                    type: 'insert'
                });
            }

            return queries;

        } catch (error) {
            console.error(`XML 파싱 실패: ${xmlFilePath}`, error.message);
            return [];
        }
    }

    /**
     * 쿼리 정규화 (공백, 파라미터 제거)
     */
    cleanQuery(queryText) {
        if (!queryText) return '';

        return queryText
            .replace(/<!--.*?-->/gs, '') // XML 주석 제거
            .replace(/#\{[^}]+\}/g, '?')  // #{param} → ?
            .replace(/\$\{[^}]+\}/g, '?')  // ${param} → ?
            .replace(/\s+/g, ' ')          // 다중 공백 → 단일 공백
            .trim();
    }

    /**
     * 워치 리스트에 쿼리 추가
     */
    addWatch(queryName, queryPattern, threshold = 1000) {
        this.watchList.push({
            name: queryName,
            pattern: new RegExp(queryPattern, 'i'),
            threshold: threshold
        });

        console.log(`✅ 워치 추가: ${queryName} (임계값: ${threshold}ms)`);
    }

    /**
     * XML 디렉토리 전체 로드
     */
    async loadFromDirectory(xmlDir) {
        const files = fs.readdirSync(xmlDir)
            .filter(f => f.endsWith('.xml'));

        let totalQueries = 0;

        for (const file of files) {
            const xmlPath = path.join(xmlDir, file);
            const queries = await this.loadQueriesFromXML(xmlPath);

            for (const query of queries) {
                // 쿼리 매핑 등록
                this.queryMap.set(this.normalizeQuery(query.text), query.name);
                totalQueries++;
            }
        }

        console.log(`📁 ${files.length}개 XML 파일에서 ${totalQueries}개 쿼리 로드`);
    }

    /**
     * 쿼리 정규화 (비교용)
     */
    normalizeQuery(queryText) {
        return queryText
            .replace(/\s+/g, ' ')
            .replace(/['"]/g, '')
            .trim()
            .substring(0, 200); // 앞 200자만 (시그니처로 사용)
    }

    /**
     * 실행 중인 쿼리 중 워치 리스트 매칭
     */
    async checkWatchedQueries() {
        const result = await this.pool.request().query(`
            SELECT
                req.session_id,
                req.status,
                req.command,
                SUBSTRING(qt.text, (req.statement_start_offset/2)+1,
                    ((CASE req.statement_end_offset
                        WHEN -1 THEN DATALENGTH(qt.text)
                        ELSE req.statement_end_offset
                    END - req.statement_start_offset)/2)+1) AS query_text,
                req.cpu_time,
                req.total_elapsed_time,
                req.logical_reads,
                req.writes,
                req.wait_type,
                req.wait_time,
                req.blocking_session_id,
                DB_NAME(req.database_id) AS database_name
            FROM sys.dm_exec_requests req
            CROSS APPLY sys.dm_exec_sql_text(req.sql_handle) AS qt
            WHERE req.session_id != @@SPID
            AND req.status = 'running'
        `);

        const alerts = [];

        for (const row of result.recordset) {
            const queryText = row.query_text;
            const normalized = this.normalizeQuery(queryText);

            // 1. 쿼리 이름 찾기 (XML에서 로드한 경우)
            const queryName = this.queryMap.get(normalized);

            // 2. 워치 리스트와 매칭
            for (const watch of this.watchList) {
                let isMatched = false;
                let matchedName = watch.name;

                if (watch.pattern.test(queryText)) {
                    isMatched = true;
                } else if (queryName && queryName === watch.name) {
                    isMatched = true;
                    matchedName = queryName;
                }

                if (isMatched && row.total_elapsed_time >= watch.threshold) {
                    alerts.push({
                        queryName: matchedName,
                        sessionId: row.session_id,
                        database: row.database_name,
                        executionTimeMs: row.total_elapsed_time,
                        cpuTimeMs: row.cpu_time,
                        logicalReads: row.logical_reads,
                        blockingSessionId: row.blocking_session_id || null,
                        waitType: row.wait_type || null,
                        queryText: queryText,
                        threshold: watch.threshold
                    });

                    // 통계 업데이트
                    this.updateStats(matchedName, row.total_elapsed_time);
                }
            }
        }

        return alerts;
    }

    /**
     * 통계 업데이트
     */
    updateStats(queryName, executionTime) {
        if (!this.stats.has(queryName)) {
            this.stats.set(queryName, {
                count: 0,
                totalTime: 0,
                maxTime: 0,
                minTime: Infinity
            });
        }

        const stats = this.stats.get(queryName);
        stats.count++;
        stats.totalTime += executionTime;
        stats.maxTime = Math.max(stats.maxTime, executionTime);
        stats.minTime = Math.min(stats.minTime, executionTime);
    }

    /**
     * 통계 조회
     */
    getStats(queryName = null) {
        if (queryName) {
            const stats = this.stats.get(queryName);
            if (!stats) return null;

            return {
                queryName: queryName,
                count: stats.count,
                avgTime: Math.round(stats.totalTime / stats.count),
                maxTime: stats.maxTime,
                minTime: stats.minTime
            };
        }

        // 전체 통계
        const allStats = [];
        for (const [name, stats] of this.stats.entries()) {
            allStats.push({
                queryName: name,
                count: stats.count,
                avgTime: Math.round(stats.totalTime / stats.count),
                maxTime: stats.maxTime,
                minTime: stats.minTime
            });
        }

        return allStats.sort((a, b) => b.avgTime - a.avgTime);
    }

    /**
     * 통계 리포트 출력
     */
    printStats() {
        const stats = this.getStats();

        if (stats.length === 0) {
            console.log('ℹ️  통계 없음');
            return;
        }

        console.log('\n' + '='.repeat(80));
        console.log('📊 워치 쿼리 통계');
        console.log('='.repeat(80));
        console.log('%-50s %8s %10s %10s %10s', 'Query Name', 'Count', 'Avg (ms)', 'Max (ms)', 'Min (ms)');
        console.log('-'.repeat(80));

        for (const stat of stats) {
            console.log('%-50s %8d %10d %10d %10d',
                stat.queryName.substring(0, 50),
                stat.count,
                stat.avgTime,
                stat.maxTime,
                stat.minTime
            );
        }

        console.log('='.repeat(80));
    }
}

module.exports = QueryWatcher;

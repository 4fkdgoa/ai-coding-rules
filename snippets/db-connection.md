# 데이터베이스 연결 가이드

Python/Node.js에서 각 DB 연결 방법

---

## Python DB 연결

### MSSQL (pymssql)

```bash
pip install pymssql
```

```python
import pymssql

def connect_mssql():
    conn = pymssql.connect(
        server='localhost',
        port=1433,
        user='sfa',
        password='sfa',
        database='BYD_Samchully_test',
        charset='utf8'
    )
    return conn

# 사용 예시
def query_users():
    conn = connect_mssql()
    cursor = conn.cursor(as_dict=True)  # 딕셔너리로 반환

    cursor.execute("""
        SELECT TOP 10 USER_ID, USER_NAME, AUTH_SEQ
        FROM sfa.SALES_USERS
        WHERE DISABLE IS NULL
    """)

    results = cursor.fetchall()
    conn.close()
    return results

# 파라미터 바인딩 (SQL Injection 방지)
def get_user_by_id(user_id: str):
    conn = connect_mssql()
    cursor = conn.cursor(as_dict=True)

    # %s 플레이스홀더 사용
    cursor.execute(
        "SELECT * FROM sfa.SALES_USERS WHERE USER_ID = %s",
        (user_id,)
    )

    result = cursor.fetchone()
    conn.close()
    return result
```

### MSSQL (pyodbc) - 더 범용적

```bash
pip install pyodbc
```

```python
import pyodbc

def connect_mssql_odbc():
    conn_str = (
        "DRIVER={ODBC Driver 17 for SQL Server};"
        "SERVER=localhost,1433;"
        "DATABASE=BYD_Samchully_test;"
        "UID=sfa;"
        "PWD=sfa;"
        "TrustServerCertificate=yes;"
    )
    return pyodbc.connect(conn_str)
```

---

### Oracle (cx_Oracle / oracledb)

```bash
# 구버전 (cx_Oracle)
pip install cx_Oracle

# 신버전 (python-oracledb) - 권장
pip install oracledb
```

#### cx_Oracle (구버전)

```python
import cx_Oracle

def connect_oracle():
    # Oracle Instant Client 경로 설정 (Windows)
    cx_Oracle.init_oracle_client(lib_dir=r"C:\oracle\instantclient_19_8")

    dsn = cx_Oracle.makedsn(
        host='localhost',
        port=1521,
        service_name='ORCL'  # 또는 sid='ORCL'
    )

    conn = cx_Oracle.connect(
        user='scott',
        password='tiger',
        dsn=dsn,
        encoding='UTF-8'
    )
    return conn

# 사용 예시
def query_oracle():
    conn = connect_oracle()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM emp WHERE deptno = :deptno", {'deptno': 10})
    results = cursor.fetchall()

    # 컬럼명 포함
    columns = [col[0] for col in cursor.description]
    data = [dict(zip(columns, row)) for row in results]

    conn.close()
    return data
```

#### oracledb (신버전, Thin 모드)

```python
import oracledb

def connect_oracle_thin():
    """Thin 모드 - Oracle Client 설치 불필요"""
    conn = oracledb.connect(
        user='scott',
        password='tiger',
        dsn='localhost:1521/ORCL'
    )
    return conn

def connect_oracle_thick():
    """Thick 모드 - Oracle Client 필요 (고급 기능)"""
    oracledb.init_oracle_client(lib_dir=r"C:\oracle\instantclient_19_8")
    conn = oracledb.connect(
        user='scott',
        password='tiger',
        dsn='localhost:1521/ORCL'
    )
    return conn
```

---

### PostgreSQL (psycopg2)

```bash
pip install psycopg2-binary
```

```python
import psycopg2
from psycopg2.extras import RealDictCursor

def connect_postgresql():
    conn = psycopg2.connect(
        host='localhost',
        port=5432,
        database='mydb',
        user='postgres',
        password='password'
    )
    return conn

def query_postgresql():
    conn = connect_postgresql()
    cursor = conn.cursor(cursor_factory=RealDictCursor)  # 딕셔너리 반환

    cursor.execute("SELECT * FROM users WHERE active = %s", (True,))
    results = cursor.fetchall()

    conn.close()
    return results
```

---

### MySQL (pymysql)

```bash
pip install pymysql
```

```python
import pymysql

def connect_mysql():
    conn = pymysql.connect(
        host='localhost',
        port=3306,
        user='root',
        password='password',
        database='mydb',
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
    )
    return conn

def query_mysql():
    conn = connect_mysql()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM users WHERE status = %s", ('active',))
    results = cursor.fetchall()

    conn.close()
    return results
```

---

## Node.js DB 연결

### MSSQL (mssql)

```bash
npm install mssql
```

```javascript
const sql = require('mssql');

const config = {
    user: 'sfa',
    password: 'sfa',
    server: 'localhost',
    port: 1433,
    database: 'BYD_Samchully_test',
    options: {
        encrypt: false,
        trustServerCertificate: true
    }
};

async function queryMssql() {
    try {
        await sql.connect(config);

        const result = await sql.query`
            SELECT TOP 10 USER_ID, USER_NAME, AUTH_SEQ
            FROM sfa.SALES_USERS
            WHERE DISABLE IS NULL
        `;

        console.log(result.recordset);
        return result.recordset;
    } catch (err) {
        console.error('MSSQL Error:', err);
        throw err;
    } finally {
        await sql.close();
    }
}

// 파라미터 바인딩 (권장)
async function getUserById(userId) {
    try {
        await sql.connect(config);

        const result = await sql.query`
            SELECT * FROM sfa.SALES_USERS
            WHERE USER_ID = ${userId}
        `;

        return result.recordset[0];
    } finally {
        await sql.close();
    }
}
```

---

### Oracle (oracledb)

```bash
npm install oracledb
```

```javascript
const oracledb = require('oracledb');

// Thin 모드 (기본, Oracle Client 불필요)
async function connectOracleThin() {
    const connection = await oracledb.getConnection({
        user: 'scott',
        password: 'tiger',
        connectString: 'localhost:1521/ORCL'
    });
    return connection;
}

// Thick 모드 (Oracle Client 필요)
async function initThickMode() {
    oracledb.initOracleClient({ libDir: 'C:\\oracle\\instantclient_19_8' });
}

async function queryOracle() {
    let connection;
    try {
        connection = await connectOracleThin();

        const result = await connection.execute(
            `SELECT * FROM emp WHERE deptno = :deptno`,
            { deptno: 10 },
            { outFormat: oracledb.OUT_FORMAT_OBJECT }  // 객체로 반환
        );

        console.log(result.rows);
        return result.rows;
    } finally {
        if (connection) {
            await connection.close();
        }
    }
}
```

---

### PostgreSQL (pg)

```bash
npm install pg
```

```javascript
const { Pool } = require('pg');

const pool = new Pool({
    host: 'localhost',
    port: 5432,
    database: 'mydb',
    user: 'postgres',
    password: 'password'
});

async function queryPostgres() {
    const client = await pool.connect();
    try {
        const result = await client.query(
            'SELECT * FROM users WHERE active = $1',
            [true]
        );
        return result.rows;
    } finally {
        client.release();
    }
}
```

---

### MySQL (mysql2)

```bash
npm install mysql2
```

```javascript
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'password',
    database: 'mydb',
    waitForConnections: true,
    connectionLimit: 10
});

async function queryMysql() {
    const [rows] = await pool.execute(
        'SELECT * FROM users WHERE status = ?',
        ['active']
    );
    return rows;
}
```

---

## 연결 풀 (Connection Pool) 패턴

### Python (SQLAlchemy)

```python
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

# MSSQL
engine = create_engine(
    "mssql+pymssql://sfa:sfa@localhost:1433/BYD_Samchully_test",
    pool_size=5,
    max_overflow=10
)

# Oracle
engine = create_engine(
    "oracle+oracledb://scott:tiger@localhost:1521/?service_name=ORCL",
    pool_size=5
)

Session = sessionmaker(bind=engine)

def query_with_pool():
    session = Session()
    try:
        result = session.execute("SELECT * FROM users")
        return result.fetchall()
    finally:
        session.close()
```

---

## 환경 변수 사용 (보안)

### Python

```python
import os
from dotenv import load_dotenv

load_dotenv()

config = {
    'server': os.getenv('DB_HOST', 'localhost'),
    'port': int(os.getenv('DB_PORT', 1433)),
    'user': os.getenv('DB_USER'),
    'password': os.getenv('DB_PASSWORD'),
    'database': os.getenv('DB_NAME')
}
```

### .env 파일

```env
DB_HOST=localhost
DB_PORT=1433
DB_USER=sfa
DB_PASSWORD=sfa
DB_NAME=BYD_Samchully_test
```

---

## 에러 처리

```python
import pymssql

def safe_query(sql: str, params: tuple = None):
    conn = None
    try:
        conn = connect_mssql()
        cursor = conn.cursor(as_dict=True)
        cursor.execute(sql, params)
        return {"success": True, "data": cursor.fetchall()}
    except pymssql.OperationalError as e:
        return {"success": False, "error": f"연결 오류: {e}"}
    except pymssql.ProgrammingError as e:
        return {"success": False, "error": f"SQL 오류: {e}"}
    except Exception as e:
        return {"success": False, "error": f"알 수 없는 오류: {e}"}
    finally:
        if conn:
            conn.close()
```

---

## DB별 요약

| DB | Python 패키지 | Node.js 패키지 | 특이사항 |
|----|--------------|--------------|---------|
| MSSQL | `pymssql` 또는 `pyodbc` | `mssql` | pymssql이 더 간단 |
| Oracle | `oracledb` (권장) 또는 `cx_Oracle` | `oracledb` | Thin 모드 = Client 불필요 |
| PostgreSQL | `psycopg2-binary` | `pg` | 가장 표준적 |
| MySQL | `pymysql` | `mysql2` | mysql2가 Promise 지원 |

---

**주의**: 실제 운영 환경에서는 반드시 환경 변수나 비밀 관리 도구를 사용하세요.

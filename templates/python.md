# Python 프로젝트 규칙

## 기술 스택
```yaml
language: Python 3.11+
framework: FastAPI / Django / Flask
package_manager: Poetry 또는 pip + requirements.txt
test: pytest
linter: ruff 또는 flake8 + black + isort
type_check: mypy (선택)
```

## 프로젝트 구조 (FastAPI)
```
project/
├── app/
│   ├── __init__.py
│   ├── main.py              # FastAPI 앱 생성
│   ├── api/
│   │   ├── __init__.py
│   │   ├── v1/
│   │   │   ├── __init__.py
│   │   │   ├── endpoints/   # 라우터
│   │   │   └── deps.py      # 의존성
│   ├── core/
│   │   ├── config.py        # 설정
│   │   └── security.py      # 인증
│   ├── models/              # SQLAlchemy 모델
│   ├── schemas/             # Pydantic 스키마
│   ├── services/            # 비즈니스 로직
│   └── db/
│       ├── base.py
│       └── session.py
├── tests/
│   ├── conftest.py
│   └── api/
├── pyproject.toml           # Poetry
├── requirements.txt         # pip
└── .env.example
```

## 네이밍 컨벤션

### 파일명
- 모듈: `snake_case.py`
- 테스트: `test_<모듈명>.py`

### 코드
| 유형 | 스타일 | 예시 |
|------|--------|------|
| 클래스 | `PascalCase` | `UserService` |
| 함수/메서드 | `snake_case` | `get_user_by_id` |
| 변수 | `snake_case` | `user_name` |
| 상수 | `UPPER_SNAKE_CASE` | `MAX_RETRY_COUNT` |
| private | `_prefix` | `_internal_method` |

### 함수명 패턴
| 동작 | 접두사 | 예시 |
|------|--------|------|
| 목록 조회 | `list_*` | `list_users()` |
| 단건 조회 | `get_*` | `get_user(id)` |
| 생성 | `create_*` | `create_user(data)` |
| 수정 | `update_*` | `update_user(id, data)` |
| 삭제 | `delete_*` | `delete_user(id)` |
| 검증 | `is_*`, `has_*` | `is_valid()`, `has_permission()` |

## 코드 스타일

### FastAPI Router
```python
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.schemas.user import UserCreate, UserResponse
from app.services.user_service import UserService

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=list[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    skip: int = 0,
    limit: int = 100,
):
    """사용자 목록 조회"""
    service = UserService(db)
    return service.list_users(skip=skip, limit=limit)


@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db)):
    """사용자 상세 조회"""
    service = UserService(db)
    user = service.get_user(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    return user


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(user_in: UserCreate, db: Session = Depends(get_db)):
    """사용자 생성"""
    service = UserService(db)
    return service.create_user(user_in)
```

### Pydantic Schema
```python
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict


class UserBase(BaseModel):
    name: str
    email: EmailStr


class UserCreate(UserBase):
    password: str


class UserResponse(UserBase):
    id: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
```

### Service Layer
```python
from sqlalchemy.orm import Session
from app.models.user import User
from app.schemas.user import UserCreate


class UserService:
    def __init__(self, db: Session):
        self.db = db

    def list_users(self, skip: int = 0, limit: int = 100) -> list[User]:
        return self.db.query(User).offset(skip).limit(limit).all()

    def get_user(self, user_id: int) -> User | None:
        return self.db.query(User).filter(User.id == user_id).first()

    def create_user(self, user_in: UserCreate) -> User:
        user = User(
            name=user_in.name,
            email=user_in.email,
            hashed_password=hash_password(user_in.password),
        )
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user
```

### SQLAlchemy Model
```python
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime
from app.db.base import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
```

## 테스트

### conftest.py
```python
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.api.deps import get_db
from app.db.base import Base

SQLALCHEMY_TEST_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_TEST_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db):
    def override_get_db():
        yield db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()
```

### 테스트 파일
```python
def test_create_user(client):
    response = client.post(
        "/api/v1/users",
        json={"name": "Test", "email": "test@example.com", "password": "secret"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test"
    assert data["email"] == "test@example.com"
    assert "id" in data


def test_get_user_not_found(client):
    response = client.get("/api/v1/users/999")
    assert response.status_code == 404
```

## pyproject.toml (Poetry)
```toml
[tool.poetry]
name = "project"
version = "0.1.0"
python = "^3.11"

[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.109.0"
uvicorn = {extras = ["standard"], version = "^0.27.0"}
sqlalchemy = "^2.0.25"
pydantic = "^2.5.3"
pydantic-settings = "^2.1.0"

[tool.poetry.group.dev.dependencies]
pytest = "^7.4.4"
httpx = "^0.26.0"
ruff = "^0.1.14"
mypy = "^1.8.0"

[tool.ruff]
line-length = 120
select = ["E", "F", "I", "N", "W"]

[tool.mypy]
python_version = "3.11"
strict = true
```

---

**이 템플릿을 CLAUDE.md에 포함하거나 참조하여 사용하세요.**

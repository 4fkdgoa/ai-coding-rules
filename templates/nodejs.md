# Node.js/TypeScript 프로젝트 규칙

## 기술 스택
```yaml
runtime: Node.js 20+
language: TypeScript 5.x
framework: Express / NestJS / Fastify
package_manager: npm / pnpm / yarn
test: Jest / Vitest
linter: ESLint + Prettier
```

## 프로젝트 구조 (Express + TypeScript)
```
project/
├── src/
│   ├── index.ts              # 앱 진입점
│   ├── app.ts                # Express 앱 설정
│   ├── routes/
│   │   ├── index.ts          # 라우터 통합
│   │   └── user.routes.ts
│   ├── controllers/
│   │   └── user.controller.ts
│   ├── services/
│   │   └── user.service.ts
│   ├── repositories/
│   │   └── user.repository.ts
│   ├── models/
│   │   └── user.model.ts
│   ├── types/
│   │   └── user.types.ts
│   ├── middlewares/
│   │   ├── error.middleware.ts
│   │   └── auth.middleware.ts
│   ├── utils/
│   │   └── logger.ts
│   └── config/
│       └── index.ts
├── tests/
│   ├── setup.ts
│   └── user.test.ts
├── package.json
├── tsconfig.json
├── .eslintrc.js
└── .env.example
```

## 네이밍 컨벤션

### 파일명
- 모듈: `kebab-case.ts` 또는 `camelCase.ts`
- 컴포넌트/클래스: `PascalCase.ts`
- 테스트: `*.test.ts` 또는 `*.spec.ts`

### 코드
| 유형 | 스타일 | 예시 |
|------|--------|------|
| 클래스 | `PascalCase` | `UserService` |
| 인터페이스 | `PascalCase` (I 접두사 금지) | `UserResponse` |
| 타입 | `PascalCase` | `CreateUserDto` |
| 함수/메서드 | `camelCase` | `getUserById` |
| 변수 | `camelCase` | `userName` |
| 상수 | `UPPER_SNAKE_CASE` | `MAX_RETRY_COUNT` |
| enum | `PascalCase` | `UserRole` |

### 함수명 패턴
| 동작 | 접두사 | 예시 |
|------|--------|------|
| 목록 조회 | `list*`, `getAll*` | `listUsers()` |
| 단건 조회 | `get*`, `find*` | `getUserById(id)` |
| 생성 | `create*` | `createUser(data)` |
| 수정 | `update*` | `updateUser(id, data)` |
| 삭제 | `delete*`, `remove*` | `deleteUser(id)` |
| 검증 | `is*`, `has*`, `can*` | `isValid()`, `hasPermission()` |

## 코드 스타일

### Types (types/user.types.ts)
```typescript
export interface User {
  id: number;
  name: string;
  email: string;
  createdAt: Date;
}

export interface CreateUserDto {
  name: string;
  email: string;
  password: string;
}

export interface UpdateUserDto {
  name?: string;
  email?: string;
}

export type UserResponse = Omit<User, 'password'>;
```

### Controller
```typescript
import { Request, Response, NextFunction } from 'express';
import { UserService } from '../services/user.service';
import { CreateUserDto, UpdateUserDto } from '../types/user.types';

export class UserController {
  constructor(private readonly userService: UserService) {}

  listUsers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await this.userService.listUsers();
      res.json(users);
    } catch (error) {
      next(error);
    }
  };

  getUserById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const user = await this.userService.getUserById(Number(id));
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.json(user);
    } catch (error) {
      next(error);
    }
  };

  createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const dto: CreateUserDto = req.body;
      const user = await this.userService.createUser(dto);
      res.status(201).json(user);
    } catch (error) {
      next(error);
    }
  };

  updateUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const dto: UpdateUserDto = req.body;
      const user = await this.userService.updateUser(Number(id), dto);
      res.json(user);
    } catch (error) {
      next(error);
    }
  };

  deleteUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      await this.userService.deleteUser(Number(id));
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  };
}
```

### Service
```typescript
import { UserRepository } from '../repositories/user.repository';
import { User, CreateUserDto, UpdateUserDto, UserResponse } from '../types/user.types';

export class UserService {
  constructor(private readonly userRepository: UserRepository) {}

  async listUsers(): Promise<UserResponse[]> {
    const users = await this.userRepository.findAll();
    return users.map(this.toResponse);
  }

  async getUserById(id: number): Promise<UserResponse | null> {
    const user = await this.userRepository.findById(id);
    return user ? this.toResponse(user) : null;
  }

  async createUser(dto: CreateUserDto): Promise<UserResponse> {
    const hashedPassword = await this.hashPassword(dto.password);
    const user = await this.userRepository.create({
      ...dto,
      password: hashedPassword,
    });
    return this.toResponse(user);
  }

  async updateUser(id: number, dto: UpdateUserDto): Promise<UserResponse> {
    const user = await this.userRepository.update(id, dto);
    return this.toResponse(user);
  }

  async deleteUser(id: number): Promise<void> {
    await this.userRepository.delete(id);
  }

  private toResponse(user: User): UserResponse {
    const { password, ...rest } = user as User & { password?: string };
    return rest;
  }

  private async hashPassword(password: string): Promise<string> {
    // bcrypt 또는 argon2 사용
    return password; // 실제 구현 필요
  }
}
```

### Routes
```typescript
import { Router } from 'express';
import { UserController } from '../controllers/user.controller';
import { UserService } from '../services/user.service';
import { UserRepository } from '../repositories/user.repository';
import { validateBody } from '../middlewares/validation.middleware';
import { createUserSchema, updateUserSchema } from '../schemas/user.schema';

const router = Router();

// DI (간단 버전)
const userRepository = new UserRepository();
const userService = new UserService(userRepository);
const userController = new UserController(userService);

router.get('/', userController.listUsers);
router.get('/:id', userController.getUserById);
router.post('/', validateBody(createUserSchema), userController.createUser);
router.put('/:id', validateBody(updateUserSchema), userController.updateUser);
router.delete('/:id', userController.deleteUser);

export default router;
```

### Error Middleware
```typescript
import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true,
  ) {
    super(message);
  }
}

export const errorMiddleware = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      status: 'error',
      message: err.message,
    });
  }

  console.error('Unexpected error:', err);
  res.status(500).json({
    status: 'error',
    message: 'Internal server error',
  });
};
```

## 테스트

### Jest 설정 (jest.config.js)
```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  testMatch: ['**/*.test.ts', '**/*.spec.ts'],
  coverageDirectory: 'coverage',
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts'],
};
```

### 테스트 파일
```typescript
import request from 'supertest';
import { app } from '../src/app';

describe('User API', () => {
  describe('GET /api/users', () => {
    it('should return empty array when no users', async () => {
      const response = await request(app).get('/api/users');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('POST /api/users', () => {
    it('should create a new user', async () => {
      const userData = {
        name: 'Test User',
        email: 'test@example.com',
        password: 'password123',
      };

      const response = await request(app)
        .post('/api/users')
        .send(userData);

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        name: 'Test User',
        email: 'test@example.com',
      });
      expect(response.body.password).toBeUndefined();
    });

    it('should return 400 for invalid email', async () => {
      const response = await request(app)
        .post('/api/users')
        .send({ name: 'Test', email: 'invalid', password: 'pass' });

      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/users/:id', () => {
    it('should return 404 for non-existent user', async () => {
      const response = await request(app).get('/api/users/999');

      expect(response.status).toBe(404);
    });
  });
});
```

## package.json (예시)
```json
{
  "name": "project",
  "version": "1.0.0",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "lint": "eslint src --ext .ts",
    "lint:fix": "eslint src --ext .ts --fix",
    "format": "prettier --write \"src/**/*.ts\""
  },
  "dependencies": {
    "express": "^4.18.2",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/jest": "^29.5.11",
    "@types/node": "^20.11.0",
    "@types/supertest": "^6.0.2",
    "@typescript-eslint/eslint-plugin": "^6.19.0",
    "@typescript-eslint/parser": "^6.19.0",
    "eslint": "^8.56.0",
    "jest": "^29.7.0",
    "prettier": "^3.2.4",
    "supertest": "^6.3.4",
    "ts-jest": "^29.1.2",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  }
}
```

## tsconfig.json
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

---

**이 템플릿을 CLAUDE.md에 포함하거나 참조하여 사용하세요.**

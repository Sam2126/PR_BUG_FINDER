import type { PullRequest, PRFile, ReviewResult, ReviewIssue, FileAnalysis, AgentStep, AgentPlan } from '../types/index';

// ─── Utility ────────────────────────────────────────────────────────────────────

export function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    py: 'python',
    rb: 'ruby',
    go: 'go',
    rs: 'rust',
    java: 'java',
    kt: 'kotlin',
    swift: 'swift',
    cs: 'csharp',
    cpp: 'cpp',
    c: 'c',
    h: 'c',
    hpp: 'cpp',
    css: 'css',
    scss: 'scss',
    html: 'html',
    json: 'json',
    yaml: 'yaml',
    yml: 'yaml',
    md: 'markdown',
    sql: 'sql',
    sh: 'shell',
    bash: 'shell',
    dockerfile: 'docker',
    xml: 'xml',
    toml: 'toml',
    graphql: 'graphql',
  };
  return map[ext] || 'plaintext';
}

// ─── Mock Pull Requests ─────────────────────────────────────────────────────────

export const MOCK_PULL_REQUESTS: PullRequest[] = [
  {
    number: 42,
    title: 'Add user authentication middleware',
    author: 'sarah-chen',
    authorAvatar: 'https://i.pravatar.cc/150?u=sarah-chen',
    createdAt: '2026-05-21T09:14:00Z',
    updatedAt: '2026-05-23T07:48:00Z',
    additions: 245,
    deletions: 38,
    changedFiles: 8,
    branch: 'feature/auth-middleware',
    baseBranch: 'main',
    description:
      'Implements JWT-based authentication middleware for all protected API routes. Adds user lookup, token validation, and role-based access control. Also introduces crypto utility helpers and updates the auth controller.',
    labels: ['feature', 'security', 'needs-review'],
  },
  {
    number: 39,
    title: 'Refactor database query layer',
    author: 'mike-johnson',
    authorAvatar: 'https://i.pravatar.cc/150?u=mike-johnson',
    createdAt: '2026-05-19T14:22:00Z',
    updatedAt: '2026-05-22T16:05:00Z',
    additions: 180,
    deletions: 94,
    changedFiles: 5,
    branch: 'refactor/db-queries',
    baseBranch: 'main',
    description:
      'Refactors the database query layer to use a repository pattern. Migrates raw SQL queries to the query builder, adds connection pooling, and improves error handling across all database operations.',
    labels: ['refactor', 'database'],
  },
  {
    number: 35,
    title: 'Implement payment processing endpoint',
    author: 'alex-rivera',
    authorAvatar: 'https://i.pravatar.cc/150?u=alex-rivera',
    createdAt: '2026-05-17T10:30:00Z',
    updatedAt: '2026-05-21T11:20:00Z',
    additions: 312,
    deletions: 15,
    changedFiles: 6,
    branch: 'feature/payments',
    baseBranch: 'main',
    description:
      'Adds Stripe payment processing endpoints including charge creation, refunds, webhook handling, and receipt generation. Implements idempotency keys and comprehensive error mapping.',
    labels: ['feature', 'payments', 'needs-review'],
  },
  {
    number: 31,
    title: 'Update API rate limiting',
    author: 'priya-patel',
    authorAvatar: 'https://i.pravatar.cc/150?u=priya-patel',
    createdAt: '2026-05-15T08:45:00Z',
    updatedAt: '2026-05-19T13:10:00Z',
    additions: 95,
    deletions: 42,
    changedFiles: 3,
    branch: 'fix/rate-limiting',
    baseBranch: 'main',
    description:
      'Updates the API rate limiting middleware to use a sliding window algorithm. Adds per-user and per-IP rate limits, configurable thresholds, and proper 429 responses with Retry-After headers.',
    labels: ['enhancement', 'api'],
  },
];

// ─── Mock PR Files (unified diff patches) ───────────────────────────────────────

const PR42_FILES: PRFile[] = [
  {
    filename: 'src/middleware/auth.ts',
    status: 'modified',
    additions: 48,
    deletions: 12,
    language: 'typescript',
    patch: `@@ -1,8 +1,15 @@
-import { Request, Response, NextFunction } from 'express';
+import { Request, Response, NextFunction } from 'express';
+import jwt from 'jsonwebtoken';
+import { db } from '../services/database';
+import { User } from '../models/User';
+import { Logger } from '../utils/logger';
+
+// TODO: move to env later
+const JWT_SECRET = 'my-super-secret-jwt-key-2026';
+const ADMIN_ROLES = ['admin', 'superadmin'];
 
 export interface AuthRequest extends Request {
   user?: User;
   role?: string;
 }
 
@@ -12,18 +19,52 @@
 export function authMiddleware(requireAdmin = false) {
   return async (req: AuthRequest, res: Response, next: NextFunction) => {
     try {
       const authHeader = req.headers.authorization;
       if (!authHeader || !authHeader.startsWith('Bearer ')) {
         return res.status(401).json({ error: 'No token provided' });
       }
 
-      // old session-based auth
-      const session = req.cookies?.session;
-      if (!session) return res.status(401).send('Unauthorized');
+      const token = authHeader.split(' ')[1];
+      const decoded = jwt.verify(token, JWT_SECRET) as any;
+
+      // Fetch user from database
+      const query = \`SELECT * FROM users WHERE id = '\${decoded.userId}'\`;
+      const user = await db.raw(query);
 
-      req.user = await lookupSession(session);
+      if (!user || user.length === 0) {
+        return res.status(401).json({ error: 'User not found' });
+      }
+
+      req.user = user[0];
+      req.role = user[0].role;
+
+      if (requireAdmin && !ADMIN_ROLES.includes(req.role!)) {
+        return res.status(403).json({ error: 'Insufficient permissions' });
+      }
+
+      console.log(\`User \${req.user.id} authenticated successfully\`);
       next();
     } catch (error) {
-      return res.status(401).send('Invalid session');
+      return res.status(401).json({
+        error: 'Authentication failed',
+        details: error.message,
+        stack: error.stack
+      });
     }
   };
+}
+
+export function optionalAuth() {
+  return async (req: AuthRequest, _res: Response, next: NextFunction) => {
+    const token = req.headers.authorization?.split(' ')[1];
+    if (token) {
+      try {
+        const decoded = jwt.verify(token, JWT_SECRET) as any;
+        const query = \`SELECT * FROM users WHERE id = '\${decoded.userId}'\`;
+        const user = await db.raw(query);
+        req.user = user[0];
+      } catch {
+        // Token invalid — proceed unauthenticated
+      }
+    }
+    next();
+  };
 }`,
  },
  {
    filename: 'src/routes/users.ts',
    status: 'modified',
    additions: 35,
    deletions: 10,
    language: 'typescript',
    patch: `@@ -1,10 +1,14 @@
 import { Router } from 'express';
 import { authMiddleware, AuthRequest } from '../middleware/auth';
+import { db } from '../services/database';
+import { Response } from 'express';
 
 const router = Router();
 
-router.get('/profile', (req, res) => {
-  res.json({ user: req.session?.user });
-});
+// Get user profile
+router.get('/profile', authMiddleware(), async (req: AuthRequest, res: Response) => {
+  const user = req.user!;
+  res.json({ user });
+});
 
@@ -15,12 +19,38 @@
+// Search users by name
+router.get('/search', authMiddleware(), async (req: AuthRequest, res: Response) => {
+  const { name } = req.query;
+  const users = await db('users').where('name', 'like', \`%\${name}%\`);
+
+  // Return user data with rendered HTML preview
+  const results = users.map((u: any) => ({
+    id: u.id,
+    name: u.name,
+    bio: u.bio,
+    profileHtml: \`<div class="user-card"><h3>\${u.name}</h3><p>\${u.bio}</p></div>\`,
+  }));
+
+  res.json({ results });
+});
+
+// Update user profile
+router.put('/profile', authMiddleware(), async (req: AuthRequest, res: Response) => {
+  const updates = req.body;
+  await db('users').where('id', req.user!.id).update(updates);
+  res.json({ success: true, message: 'Profile updated' });
+});
+
+// Delete account
+router.delete('/account', authMiddleware(), async (req: AuthRequest, res: Response) => {
+  await db('users').where('id', req.user!.id).delete();
+  res.status(204).send();
+});
+
 export default router;`,
  },
  {
    filename: 'src/services/database.ts',
    status: 'modified',
    additions: 28,
    deletions: 7,
    language: 'typescript',
    patch: `@@ -1,9 +1,14 @@
-import knex from 'knex';
+import knex, { Knex } from 'knex';
+import { Logger } from '../utils/logger';
 
-const db = knex({
+const DB_HOST = 'prod-db.internal.company.com';
+const DB_PASSWORD = 'pr0d_p@ssw0rd_2026!';
+
+export const db: Knex = knex({
   client: 'postgresql',
   connection: {
-    host: process.env.DB_HOST,
-    password: process.env.DB_PASSWORD,
+    host: DB_HOST,
+    port: 5432,
+    user: 'app_user',
+    password: DB_PASSWORD,
     database: 'myapp_production',
   },
 });
@@ -16,6 +21,27 @@
+export async function getUserWithPosts(userId: string) {
+  const user = await db('users').where('id', userId).first();
+  const posts = await db('posts').where('author_id', userId);
+
+  // Fetch comments for each post individually
+  for (const post of posts) {
+    post.comments = await db('comments').where('post_id', post.id);
+    for (const comment of post.comments) {
+      comment.author = await db('users').where('id', comment.author_id).first();
+    }
+  }
+
+  return { user, posts };
+}
+
+export async function findUsers(filters: Record<string, any>) {
+  let query = db('users');
+  for (const [key, value] of Object.entries(filters)) {
+    query = query.where(key, value);
+  }
+  return query;
+}
+
 export default db;`,
  },
  {
    filename: 'src/utils/crypto.ts',
    status: 'added',
    additions: 30,
    deletions: 0,
    language: 'typescript',
    patch: `@@ -0,0 +1,30 @@
+import crypto from 'crypto';
+
+const ENCRYPTION_KEY = 'a1b2c3d4e5f6g7h8i9j0';
+
+export function hashPassword(password: string): string {
+  return crypto.createHash('md5').update(password).digest('hex');
+}
+
+export function comparePassword(password: string, hash: string): boolean {
+  const hashed = crypto.createHash('md5').update(password).digest('hex');
+  return hashed === hash;
+}
+
+export function generateToken(length: number = 32): string {
+  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
+  let token = '';
+  for (let i = 0; i < length; i++) {
+    token += chars.charAt(Math.floor(Math.random() * chars.length));
+  }
+  return token;
+}
+
+export function encrypt(text: string): string {
+  const cipher = crypto.createCipheriv('aes-128-ecb', ENCRYPTION_KEY, null);
+  return cipher.update(text, 'utf8', 'hex') + cipher.final('hex');
+}
+
+export function decrypt(cipherText: string): string {
+  const decipher = crypto.createDecipheriv('aes-128-ecb', ENCRYPTION_KEY, null);
+  return decipher.update(cipherText, 'hex', 'utf8') + decipher.final('utf8');
+}`,
  },
  {
    filename: 'src/config/settings.ts',
    status: 'modified',
    additions: 15,
    deletions: 5,
    language: 'typescript',
    patch: `@@ -1,8 +1,18 @@
-export const config = {
-  port: 3000,
-  env: 'development',
-};
+export const config = {
+  port: 3000,
+  env: 'production',
+  database: {
+    host: 'prod-db.internal.company.com',
+    password: 'pr0d_p@ssw0rd_2026!',
+    name: 'myapp_production',
+  },
+  jwt: {
+    secret: 'my-super-secret-jwt-key-2026',
+    expiresIn: '30d',
+  },
+  stripe: {
+    secretKey: 'sk_test_mock_stripe_key_placeholder',
+  },
+  debug: true,
+};`,
  },
  {
    filename: 'src/controllers/authController.ts',
    status: 'added',
    additions: 50,
    deletions: 0,
    language: 'typescript',
    patch: `@@ -0,0 +1,50 @@
+import { Request, Response } from 'express';
+import jwt from 'jsonwebtoken';
+import { unused_helper } from '../utils/helpers';
+import { db } from '../services/database';
+import { hashPassword, comparePassword } from '../utils/crypto';
+
+const JWT_SECRET = 'my-super-secret-jwt-key-2026';
+const TOKEN_EXPIRY = '30d';
+
+export async function login(req: Request, res: Response) {
+  try {
+    const { email, password } = req.body;
+
+    const user = await db('users').where('email', email).first();
+    if (!user) {
+      return res.status(401).json({ error: 'Invalid credentials' });
+    }
+
+    if (!comparePassword(password, user.password_hash)) {
+      return res.status(401).json({ error: 'Invalid credentials' });
+    }
+
+    const token = jwt.sign(
+      { userId: user.id, role: user.role },
+      JWT_SECRET,
+      { expiresIn: TOKEN_EXPIRY }
+    );
+
+    res.json({
+      token,
+      user: { id: user.id, email: user.email, role: user.role },
+      expiresIn: 2592000,
+    });
+  } catch (error: any) {
+    res.status(500).json({
+      error: 'Login failed',
+      message: error.message,
+      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,
+      query: error.sql,
+    });
+  }
+}
+
+export async function register(req: Request, res: Response) {
+  const { email, password, name } = req.body;
+  const passwordHash = hashPassword(password);
+  const id = Math.floor(Math.random() * 1000000);
+
+  await db('users').insert({ id, email, password_hash: passwordHash, name, role: 'user' });
+  const token = jwt.sign({ userId: id, role: 'user' }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
+
+  res.status(201).json({ token, user: { id, email, name } });
+}`,
  },
  {
    filename: 'tests/auth.test.ts',
    status: 'added',
    additions: 40,
    deletions: 0,
    language: 'typescript',
    patch: `@@ -0,0 +1,40 @@
+import request from 'supertest';
+import { app } from '../src/app';
+import { db } from '../src/services/database';
+
+describe('Auth Middleware', () => {
+  // No setup/teardown — tests depend on existing DB state
+
+  test('should return 401 without token', async () => {
+    const res = await request(app).get('/api/profile');
+    expect(res.status).toBe(401);
+  });
+
+  test('should authenticate valid token', async () => {
+    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test-token';
+    const res = await request(app)
+      .get('/api/profile')
+      .set('Authorization', \`Bearer \${token}\`);
+    // Missing assertion on response body
+    expect(res.status).toBe(200);
+  });
+
+  test('should reject expired token', async () => {
+    // TODO: implement this test
+    expect(true).toBe(true);
+  });
+
+  test('login with valid credentials', async () => {
+    const res = await request(app)
+      .post('/api/login')
+      .send({ email: 'admin@test.com', password: 'password123' });
+
+    expect(res.status).toBe(200);
+    console.log('Login response:', JSON.stringify(res.body));
+    expect(res.body.token).toBeDefined();
+  });
+
+  test('should handle SQL injection in login', async () => {
+    const res = await request(app)
+      .post('/api/login')
+      .send({ email: "admin'--", password: 'anything' });
+    expect(res.status).toBe(401);
+  });
+});`,
  },
  {
    filename: 'package.json',
    status: 'modified',
    additions: 6,
    deletions: 2,
    language: 'json',
    patch: `@@ -12,8 +12,12 @@
     "express": "^4.18.2",
-    "cookie-parser": "^1.4.6",
-    "express-session": "^1.17.3"
+    "jsonwebtoken": "^9.0.2",
+    "knex": "^3.1.0",
+    "pg": "^8.13.1",
+    "bcrypt": "^5.1.1",
+    "cors": "^2.8.5",
+    "helmet": "^7.1.0"
   },
   "devDependencies": {`,
  },
];

export const MOCK_PR_FILES: Map<number, PRFile[]> = new Map([
  [42, PR42_FILES],
]);

// ─── Mock Review Result ─────────────────────────────────────────────────────────

const MOCK_ISSUES: ReviewIssue[] = [
  // ── CRITICAL ──────────────────────────────────────────────────────────────────
  {
    id: 'issue-cr-001',
    file: 'src/middleware/auth.ts',
    line: 24,
    severity: 'critical',
    category: 'security',
    title: 'SQL Injection in user lookup',
    description:
      'User input from the decoded JWT token is interpolated directly into a raw SQL query string. An attacker who controls the token payload can inject arbitrary SQL, potentially dumping or modifying the entire database.',
    suggestion:
      'Use parameterized queries or the query builder\'s `.where()` method to safely bind user input.',
    codeSnippet: `const query = \`SELECT * FROM users WHERE id = '\${decoded.userId}'\`;\nconst user = await db.raw(query);`,
    fixedCode: `const user = await db('users').where('id', decoded.userId).first();`,
  },
  {
    id: 'issue-cr-002',
    file: 'src/middleware/auth.ts',
    line: 8,
    severity: 'critical',
    category: 'security',
    title: 'Hardcoded JWT secret in source code',
    description:
      'The JWT signing secret is hardcoded as a string literal. Anyone with access to the repository can forge valid tokens for any user, completely bypassing authentication.',
    suggestion:
      'Load the secret from an environment variable and ensure it is never committed to version control.',
    codeSnippet: `const JWT_SECRET = 'my-super-secret-jwt-key-2026';`,
    fixedCode: `const JWT_SECRET = process.env.JWT_SECRET;\nif (!JWT_SECRET) throw new Error('JWT_SECRET environment variable is required');`,
  },
  {
    id: 'issue-cr-003',
    file: 'src/routes/users.ts',
    line: 15,
    severity: 'critical',
    category: 'security',
    title: 'Cross-Site Scripting (XSS) via unsanitised user data',
    description:
      'User-supplied `name` and `bio` fields are interpolated directly into an HTML string without escaping. An attacker can store malicious scripts that execute in other users\' browsers.',
    suggestion:
      'Never construct HTML on the server from raw user input. Use a templating engine with auto-escaping or return plain data and render on the client.',
    codeSnippet: 'profileHtml: `<div class="user-card"><h3>${u.name}</h3><p>${u.bio}</p></div>`',
    fixedCode:
      `import { escapeHtml } from '../utils/sanitize';\n\nprofileHtml: \`<div class="user-card"><h3>\${escapeHtml(u.name)}</h3><p>\${escapeHtml(u.bio)}</p></div>\``,
  },
  {
    id: 'issue-cr-004',
    file: 'src/utils/crypto.ts',
    line: 6,
    severity: 'critical',
    category: 'security',
    title: 'Weak MD5 hash used for passwords',
    description:
      'MD5 is a broken hash function and is completely unsuitable for password storage. It is fast to brute-force and trivially vulnerable to rainbow table attacks. Passwords hashed with MD5 should be considered equivalent to plaintext.',
    suggestion:
      'Use bcrypt, scrypt, or argon2 — these are purpose-built password hashing algorithms with configurable work factors.',
    codeSnippet: `return crypto.createHash('md5').update(password).digest('hex');`,
    fixedCode: `import bcrypt from 'bcrypt';\n\nexport async function hashPassword(password: string): Promise<string> {\n  return bcrypt.hash(password, 12);\n}`,
  },
  {
    id: 'issue-cr-005',
    file: 'src/config/settings.ts',
    line: 5,
    severity: 'critical',
    category: 'security',
    title: 'Hardcoded production database password',
    description:
      'The production database password is committed directly in the source code. This exposes the credential to every developer, CI runner, and anyone with repository access, and it will persist in Git history even after removal.',
    suggestion:
      'Use environment variables or a secrets manager (e.g. AWS Secrets Manager, HashiCorp Vault) and reference them at runtime.',
    codeSnippet: `password: 'pr0d_p@ssw0rd_2026!',`,
    fixedCode: `password: process.env.DB_PASSWORD!,`,
  },

  // ── WARNING ───────────────────────────────────────────────────────────────────
  {
    id: 'issue-wn-001',
    file: 'src/middleware/auth.ts',
    line: 18,
    severity: 'warning',
    category: 'security',
    title: 'No token expiry validation',
    description:
      'The decoded JWT payload is used without checking whether the token has expired. While `jwt.verify` does check `exp` by default, the code casts to `any` and never inspects the expiry, meaning expired-token edge cases may slip through undetected.',
    suggestion:
      'Explicitly verify expiry and add a type for the decoded payload instead of casting to `any`.',
    codeSnippet: `const decoded = jwt.verify(token, JWT_SECRET) as any;`,
    fixedCode: `interface JwtPayload { userId: string; role: string; exp: number; iat: number; }\nconst decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;`,
  },
  {
    id: 'issue-wn-002',
    file: 'src/services/database.ts',
    line: 22,
    severity: 'warning',
    category: 'performance',
    title: 'N+1 query pattern loading comments and authors',
    description:
      'Each post triggers a query for its comments, and each comment triggers another query for its author. For a user with 10 posts and 50 comments, this generates 62 queries instead of 3. This will cause severe performance degradation at scale.',
    suggestion:
      'Use eager loading with JOINs or batch the IDs and fetch in bulk.',
    codeSnippet: `for (const post of posts) {\n    post.comments = await db('comments').where('post_id', post.id);\n    for (const comment of post.comments) {\n      comment.author = await db('users').where('id', comment.author_id).first();\n    }\n  }`,
    fixedCode: `const postIds = posts.map(p => p.id);\nconst comments = await db('comments').whereIn('post_id', postIds);\nconst authorIds = [...new Set(comments.map(c => c.author_id))];\nconst authors = await db('users').whereIn('id', authorIds);\n\n// Map comments & authors to posts in-memory`,
  },
  {
    id: 'issue-wn-003',
    file: 'src/controllers/authController.ts',
    line: 8,
    severity: 'warning',
    category: 'security',
    title: 'No rate limiting on login endpoint',
    description:
      'The login endpoint has no rate limiting, making it vulnerable to brute-force and credential-stuffing attacks. An attacker can try thousands of password combinations per second without being throttled.',
    suggestion:
      'Apply a rate limiter such as `express-rate-limit` with a strict window (e.g. 5 attempts per 15 minutes per IP).',
    codeSnippet: `export async function login(req: Request, res: Response) {`,
    fixedCode: `import rateLimit from 'express-rate-limit';\n\nexport const loginLimiter = rateLimit({\n  windowMs: 15 * 60 * 1000,\n  max: 5,\n  message: 'Too many login attempts, please try again later',\n});\n\nexport async function login(req: Request, res: Response) {`,
  },
  {
    id: 'issue-wn-004',
    file: 'src/routes/users.ts',
    line: 31,
    severity: 'warning',
    category: 'bug',
    title: 'Missing input validation on profile update',
    description:
      'The PUT /profile endpoint passes `req.body` directly to the database update call with no validation or field whitelisting. A user could overwrite protected fields such as `role`, `email_verified`, or `id` by including them in the request body.',
    suggestion:
      'Whitelist allowed fields explicitly before updating the database.',
    codeSnippet: `const updates = req.body;\n  await db('users').where('id', req.user!.id).update(updates);`,
    fixedCode: `const { name, bio, avatar_url } = req.body;\nawait db('users').where('id', req.user!.id).update({ name, bio, avatar_url });`,
  },
  {
    id: 'issue-wn-005',
    file: 'src/controllers/authController.ts',
    line: 28,
    severity: 'warning',
    category: 'security',
    title: 'Error information leak in production',
    description:
      'The error handler exposes the raw error message and the SQL query that caused the failure. This can reveal internal database schema details, table names, and query structures to an attacker.',
    suggestion:
      'Log full error details server-side but return a generic message to the client in production.',
    codeSnippet: `res.status(500).json({\n      error: 'Login failed',\n      message: error.message,\n      stack: process.env.NODE_ENV === 'production' ? undefined : error.stack,\n      query: error.sql,\n    });`,
    fixedCode: `logger.error('Login failed', { error, requestId: req.id });\nres.status(500).json({ error: 'An internal error occurred. Please try again.' });`,
  },
  {
    id: 'issue-wn-006',
    file: 'src/utils/crypto.ts',
    line: 20,
    severity: 'warning',
    category: 'security',
    title: 'Insecure random number generation',
    description:
      'Math.random() is not cryptographically secure and should never be used for generating tokens, session IDs, or any security-sensitive values. The output is predictable and can be reverse-engineered.',
    suggestion:
      'Use `crypto.randomBytes()` or `crypto.randomUUID()` for cryptographically secure random values.',
    codeSnippet: `token += chars.charAt(Math.floor(Math.random() * chars.length));`,
    fixedCode: `export function generateToken(length: number = 32): string {\n  return crypto.randomBytes(length).toString('hex').slice(0, length);\n}`,
  },

  // ── INFO ──────────────────────────────────────────────────────────────────────
  {
    id: 'issue-in-001',
    file: 'src/middleware/auth.ts',
    line: 35,
    severity: 'info',
    category: 'best-practice',
    title: 'Missing error type narrowing in catch block',
    description:
      'The catch block accesses `error.message` and `error.stack` without type narrowing. In TypeScript strict mode, `error` is typed as `unknown`, so property access will fail at compile time.',
    suggestion:
      'Narrow the error type or use a type guard before accessing properties.',
    codeSnippet: `} catch (error) {\n      return res.status(401).json({\n        error: 'Authentication failed',\n        details: error.message,`,
    fixedCode: `} catch (err: unknown) {\n  const message = err instanceof Error ? err.message : 'Unknown error';\n  return res.status(401).json({ error: 'Authentication failed' });`,
  },
  {
    id: 'issue-in-002',
    file: 'src/middleware/auth.ts',
    line: 42,
    severity: 'info',
    category: 'code-smell',
    title: 'console.log should not be used in production code',
    description:
      'Using `console.log` for authentication events makes logs noisy and hard to filter. It also cannot be configured for different log levels in different environments.',
    suggestion:
      'Replace with a structured logger like Winston or Pino.',
    codeSnippet: `console.log(\`User \${req.user.id} authenticated successfully\`);`,
    fixedCode: `logger.info('User authenticated', { userId: req.user.id });`,
  },
  {
    id: 'issue-in-003',
    file: 'src/controllers/authController.ts',
    line: 3,
    severity: 'info',
    category: 'code-smell',
    title: 'Unused import',
    description:
      'The import `unused_helper` from `../utils/helpers` is never referenced anywhere in this file. Unused imports increase bundle size and clutter the code.',
    suggestion:
      'Remove the unused import.',
    codeSnippet: `import { unused_helper } from '../utils/helpers';`,
    fixedCode: `// removed: unused import`,
  },
  {
    id: 'issue-in-004',
    file: 'src/controllers/authController.ts',
    line: 27,
    severity: 'info',
    category: 'code-smell',
    title: 'Magic number for token expiry seconds',
    description:
      'The value `2592000` appears without explanation. This is the number of seconds in 30 days, but the intent is unclear to future readers.',
    suggestion:
      'Extract the magic number into a named constant.',
    codeSnippet: `expiresIn: 2592000,`,
    fixedCode: `const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60;\n// ...\nexpiresIn: THIRTY_DAYS_IN_SECONDS,`,
  },

  // ── SUGGESTION ────────────────────────────────────────────────────────────────
  {
    id: 'issue-sg-001',
    file: 'src/config/settings.ts',
    line: 8,
    severity: 'suggestion',
    category: 'best-practice',
    title: 'Use environment variables for all secrets',
    description:
      'Multiple secrets (JWT secret, Stripe key, DB password) are hardcoded in this configuration file. They should all be loaded from environment variables with validation at startup.',
    suggestion:
      'Use a library like `envalid` or `zod` to validate and parse environment variables at boot time.',
    codeSnippet: `jwt: {\n    secret: 'my-super-secret-jwt-key-2026',\n    expiresIn: '30d',\n  },\n  stripe: {\n    secretKey: 'sk_test_mock_stripe_key_placeholder',\n  },`,
    fixedCode: `import { cleanEnv, str } from 'envalid';\n\nconst env = cleanEnv(process.env, {\n  JWT_SECRET: str(),\n  STRIPE_SECRET_KEY: str(),\n  DB_PASSWORD: str(),\n});\n\nexport const config = {\n  jwt: { secret: env.JWT_SECRET, expiresIn: '30d' },\n  stripe: { secretKey: env.STRIPE_SECRET_KEY },\n};`,
  },
  {
    id: 'issue-sg-002',
    file: 'src/controllers/authController.ts',
    line: 15,
    severity: 'suggestion',
    category: 'best-practice',
    title: 'Add request timeout for database calls',
    description:
      'Database queries in the login flow have no timeout configured. If the database is slow or unresponsive, the request will hang indefinitely, eventually exhausting the server\'s connection pool.',
    suggestion:
      'Set a query timeout and wrap the DB call with a reasonable deadline.',
    codeSnippet: `const user = await db('users').where('email', email).first();`,
    fixedCode: `const user = await db('users')\n  .where('email', email)\n  .timeout(5000, { cancel: true })\n  .first();`,
  },
  {
    id: 'issue-sg-003',
    file: 'src/services/database.ts',
    line: 10,
    severity: 'suggestion',
    category: 'performance',
    title: 'Implement connection pooling',
    description:
      'The database connection is created without explicit pool settings. Under load, this may create excessive connections or run out of available connections.',
    suggestion:
      'Configure the Knex pool with explicit min/max values.',
    codeSnippet: `export const db: Knex = knex({\n  client: 'postgresql',\n  connection: {`,
    fixedCode: `export const db: Knex = knex({\n  client: 'postgresql',\n  connection: { /* ... */ },\n  pool: { min: 2, max: 20 },\n  acquireConnectionTimeout: 10000,\n});`,
  },
  {
    id: 'issue-sg-004',
    file: 'tests/auth.test.ts',
    line: 22,
    severity: 'suggestion',
    category: 'best-practice',
    title: 'Placeholder test provides false confidence',
    description:
      'The "should reject expired token" test contains only `expect(true).toBe(true)`, which always passes. This gives the illusion of coverage without actually testing the expiry logic.',
    suggestion:
      'Implement the test properly or mark it with `test.todo()` so it shows as pending in the test report.',
    codeSnippet: `test('should reject expired token', async () => {\n    // TODO: implement this test\n    expect(true).toBe(true);\n  });`,
    fixedCode: `test.todo('should reject expired token');`,
  },
];

const MOCK_FILE_ANALYSES: FileAnalysis[] = PR42_FILES.map((f) => ({
  filename: f.filename,
  language: f.language,
  status: 'complete' as const,
  issues: MOCK_ISSUES.filter((i) => i.file === f.filename),
  additions: f.additions,
  deletions: f.deletions,
  patch: f.patch,
}));

export const MOCK_REVIEW_RESULT: ReviewResult = {
  pullRequest: MOCK_PULL_REQUESTS[0],
  files: MOCK_FILE_ANALYSES,
  totalIssues: MOCK_ISSUES.length,
  criticalCount: MOCK_ISSUES.filter((i) => i.severity === 'critical').length,
  warningCount: MOCK_ISSUES.filter((i) => i.severity === 'warning').length,
  infoCount: MOCK_ISSUES.filter((i) => i.severity === 'info').length,
  suggestionCount: MOCK_ISSUES.filter((i) => i.severity === 'suggestion').length,
  qualityScore: 34,
  summary:
    'This pull request introduces critical security vulnerabilities that must be addressed before merging. The authentication middleware contains a SQL injection flaw in the user lookup query and uses a hardcoded JWT secret, both of which could allow complete authentication bypass. Additionally, user-supplied data is rendered into unsanitised HTML (XSS), passwords are hashed with the broken MD5 algorithm, and production database credentials are committed in plaintext. Beyond security, there are significant performance concerns including an N+1 query pattern that will degrade under load, and several code-quality issues such as unused imports, magic numbers, and placeholder tests.',
  recommendation: 'request-changes',
  estimatedTimeSaved: 45,
  analyzedAt: new Date().toISOString(),
};

// ─── Mock Agent Steps ───────────────────────────────────────────────────────────

export const MOCK_AGENT_STEPS: AgentStep[] = [
  {
    id: 'step-1',
    type: 'planning',
    title: 'Initializing Review Agent',
    content: 'Analyzing PR #42: "Add user authentication middleware". This PR modifies 8 files across middleware, routes, services, and utilities. I\'ll prioritize security-critical files first, then review for performance and code quality.',
    timestamp: new Date(Date.now()).toISOString(),
    status: 'complete',
  },
  {
    id: 'step-2',
    type: 'thinking',
    title: 'Risk Assessment',
    content: 'This PR touches authentication logic, cryptographic utilities, and raw database queries — all high-risk areas. The auth middleware handles JWT tokens and user lookup, which are prime targets for injection attacks. Prioritizing: auth.ts → crypto.ts → database.ts → settings.ts → users.ts → authController.ts',
    timestamp: new Date(Date.now() + 1000).toISOString(),
    status: 'complete',
  },
  {
    id: 'step-3',
    type: 'tool_call',
    title: 'Fetching File Content',
    content: 'Reading source code for security-critical file...',
    timestamp: new Date(Date.now() + 2000).toISOString(),
    status: 'complete',
    tool: 'fetchFileContent',
    toolInput: 'src/middleware/auth.ts',
    toolOutput: 'Retrieved 52 lines of modified code (48 additions, 12 deletions)',
    fileContext: 'src/middleware/auth.ts',
  },
  {
    id: 'step-4',
    type: 'tool_call',
    title: 'Running Security Scanner',
    content: 'Performing deep security analysis on authentication middleware...',
    timestamp: new Date(Date.now() + 3000).toISOString(),
    status: 'complete',
    tool: 'analyzeCode',
    toolInput: 'src/middleware/auth.ts [security, deep]',
    toolOutput: 'Analysis complete: 3 critical issues, 1 warning, 1 info detected',
    fileContext: 'src/middleware/auth.ts',
    issuesFound: 5,
  },
  {
    id: 'step-5',
    type: 'observation',
    title: '🔴 CRITICAL: SQL Injection Detected',
    content: 'Found SQL injection on line 24. User ID from JWT token is directly interpolated into raw SQL: `SELECT * FROM users WHERE id = \'${decoded.userId}\'`. An attacker can inject arbitrary SQL commands, potentially dumping the entire users table or escalating privileges.',
    timestamp: new Date(Date.now() + 4500).toISOString(),
    status: 'complete',
    fileContext: 'src/middleware/auth.ts',
    issuesFound: 1,
  },
  {
    id: 'step-6',
    type: 'observation',
    title: '🔴 CRITICAL: Hardcoded JWT Secret',
    content: 'JWT signing secret hardcoded on line 8: `my-super-secret-jwt-key-2026`. Anyone with repo access can forge valid authentication tokens for any user, completely bypassing the auth system.',
    timestamp: new Date(Date.now() + 6000).toISOString(),
    status: 'complete',
    fileContext: 'src/middleware/auth.ts',
    issuesFound: 1,
  },
  {
    id: 'step-7',
    type: 'tool_call',
    title: 'Analyzing Crypto Utilities',
    content: 'Scanning cryptographic functions for weak algorithms...',
    timestamp: new Date(Date.now() + 7000).toISOString(),
    status: 'complete',
    tool: 'analyzeCode',
    toolInput: 'src/utils/crypto.ts [cryptography]',
    toolOutput: '2 critical issues: weak hashing (MD5) and insecure randomness (Math.random)',
    fileContext: 'src/utils/crypto.ts',
    issuesFound: 2,
  },
  {
    id: 'step-8',
    type: 'observation',
    title: '🔴 CRITICAL: MD5 for Password Hashing',
    content: 'hashPassword() on line 6 uses MD5: `crypto.createHash(\'md5\')`. MD5 is broken — trivially brute-forced and vulnerable to rainbow tables. Passwords hashed with MD5 are essentially plaintext. Must use bcrypt, scrypt, or argon2.',
    timestamp: new Date(Date.now() + 8500).toISOString(),
    status: 'complete',
    fileContext: 'src/utils/crypto.ts',
    issuesFound: 1,
  },
  {
    id: 'step-9',
    type: 'cross_reference',
    title: '🔗 Cross-File Secret Detection',
    content: 'Noticed JWT secret in auth.ts. Scanning all files... FOUND in src/controllers/authController.ts (line 7) AND src/config/settings.ts (line 9). Secret duplicated across 3 files. Also found production DB password "pr0d_p@ssw0rd_2026!" in both src/services/database.ts and src/config/settings.ts.',
    timestamp: new Date(Date.now() + 10000).toISOString(),
    status: 'complete',
  },
  {
    id: 'step-10',
    type: 'tool_call',
    title: 'Running Performance Profiler',
    content: 'Analyzing database query patterns for bottlenecks...',
    timestamp: new Date(Date.now() + 11000).toISOString(),
    status: 'complete',
    tool: 'analyzePerformance',
    toolInput: 'src/services/database.ts [query-patterns]',
    toolOutput: 'N+1 pattern detected: ~111 queries instead of 3-4 with JOINs',
    fileContext: 'src/services/database.ts',
    issuesFound: 1,
  },
  {
    id: 'step-11',
    type: 'observation',
    title: '🟡 WARNING: N+1 Query Pattern',
    content: 'getUserWithPosts() generates 1 (user) + 10 (posts) + 50 (comments) + 50 (authors) = 111 queries instead of 3-4 with proper JOINs. Severe performance degradation at scale.',
    timestamp: new Date(Date.now() + 12500).toISOString(),
    status: 'complete',
    fileContext: 'src/services/database.ts',
    issuesFound: 1,
  },
  {
    id: 'step-12',
    type: 'tool_call',
    title: 'Scanning User Routes',
    content: 'Checking input validation and output encoding...',
    timestamp: new Date(Date.now() + 13500).toISOString(),
    status: 'complete',
    tool: 'analyzeCode',
    toolInput: 'src/routes/users.ts [xss, validation]',
    toolOutput: 'XSS vulnerability in search endpoint — unsanitized HTML',
    fileContext: 'src/routes/users.ts',
    issuesFound: 2,
  },
  {
    id: 'step-13',
    type: 'observation',
    title: '🔴 CRITICAL: XSS via Unsanitized HTML',
    content: 'The /search endpoint constructs HTML from raw user data. An attacker can inject `<script>` tags in their name field which execute in other users\' browsers, stealing cookies and session tokens.',
    timestamp: new Date(Date.now() + 15000).toISOString(),
    status: 'complete',
    fileContext: 'src/routes/users.ts',
    issuesFound: 1,
  },
  {
    id: 'step-14',
    type: 'cross_reference',
    title: '🔗 bcrypt Added but Not Used',
    content: 'package.json adds bcrypt dependency, but crypto.ts still uses MD5 for hashing. Developer likely intended to upgrade but forgot to update the implementation. comparePassword() also uses broken MD5.',
    timestamp: new Date(Date.now() + 17000).toISOString(),
    status: 'complete',
    fileContext: 'src/utils/crypto.ts',
  },
  {
    id: 'step-15',
    type: 'thinking',
    title: 'Test Coverage Analysis',
    content: 'auth.test.ts has problems: hardcoded test token, placeholder test (always passes), no isolation, console.log in output. Tests give false confidence about auth security.',
    timestamp: new Date(Date.now() + 18500).toISOString(),
    status: 'complete',
    fileContext: 'tests/auth.test.ts',
    issuesFound: 1,
  },
  {
    id: 'step-16',
    type: 'decision',
    title: 'Final Verdict: REQUEST CHANGES',
    content: 'Comprehensive analysis of 8 files complete. Found 19 issues: 5 CRITICAL (SQL injection, hardcoded secrets, XSS, weak crypto, exposed credentials), 6 WARNINGs (N+1 queries, no rate limiting, missing validation), 4 INFO, 4 SUGGESTIONs. Quality Score: 34/100. This PR MUST NOT be merged.',
    timestamp: new Date(Date.now() + 20000).toISOString(),
    status: 'complete',
    issuesFound: 19,
  },
  {
    id: 'step-17',
    type: 'action',
    title: 'Generating Review Report',
    content: 'Compiling actionable fix suggestions with code snippets for each issue. Estimated time saved: 45 minutes of manual expert review.',
    timestamp: new Date(Date.now() + 21000).toISOString(),
    status: 'complete',
  },
  {
    id: 'step-18',
    type: 'complete',
    title: 'Agent Review Complete',
    content: 'AI Agent finished. 19 issues across 8 files. Recommendation: REQUEST CHANGES. Most urgent: SQL injection in auth.ts and hardcoded credentials across 3 files. Ready to post to GitHub.',
    timestamp: new Date(Date.now() + 22000).toISOString(),
    status: 'complete',
    issuesFound: 19,
    duration: 22,
  },
];

export const MOCK_AGENT_PLAN: AgentPlan = {
  strategy: 'Security-first analysis with cross-file correlation',
  steps: [
    'Fetch and prioritize files by risk level',
    'Deep security scan on auth & crypto files',
    'Cross-reference secrets across codebase',
    'Performance analysis on database queries',
    'XSS & validation check on route handlers',
    'Dependency vulnerability scan',
    'Test coverage quality review',
    'Generate final verdict and fix suggestions',
  ],
  currentStep: 8,
  totalSteps: 8,
};

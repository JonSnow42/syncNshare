import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();

describe('Authentication Flow & API Security', () => {
  const validUser = {
    displayName: 'Alice Cooper',
    email: 'alice@example.com',
    password: 'SecurePassword123!',
  };

  it('should successfully register a new user and set HttpOnly session cookie', async () => {
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(validUser)
      .expect(201);

    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe(validUser.email.toLowerCase());
    expect(res.body.user.displayName).toBe(validUser.displayName);
    expect(res.body.user.passwordHash).toBeUndefined();

    // Verify session cookie
    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    expect(cookies.some((c: string) => c.includes('syncnshare_session='))).toBe(true);
    expect(cookies.some((c: string) => c.includes('HttpOnly'))).toBe(true);
  });

  it('should reject registration with invalid email or weak password', async () => {
    const invalidUser = {
      displayName: 'Bob',
      email: 'not-an-email',
      password: 'short',
    };

    const res = await request(app)
      .post('/api/v1/auth/register')
      .send(invalidUser)
      .expect(400);

    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should reject duplicate email registration', async () => {
    // First registration
    await request(app).post('/api/v1/auth/register').send(validUser).expect(201);

    // Second registration with same email
    const res = await request(app)
      .post('/api/v1/auth/register')
      .send({ ...validUser, displayName: 'Another Alice' })
      .expect(409);

    expect(res.body.error.message).toContain('already exists');
  });

  it('should log in an existing user with valid credentials', async () => {
    await request(app).post('/api/v1/auth/register').send(validUser).expect(201);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: validUser.email,
        password: validUser.password,
      })
      .expect(200);

    expect(res.body.user.email).toBe(validUser.email);
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('should reject login with wrong password', async () => {
    await request(app).post('/api/v1/auth/register').send(validUser).expect(201);

    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: validUser.email,
        password: 'WrongPassword!',
      })
      .expect(401);

    expect(res.body.error.code).toBe('UnauthorizedError');
  });

  it('should restore authenticated session from /me endpoint via cookie', async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send(validUser).expect(201);
    const cookie = regRes.headers['set-cookie'];

    const meRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', cookie)
      .expect(200);

    expect(meRes.body.user.email).toBe(validUser.email);
    expect(meRes.body.user.displayName).toBe(validUser.displayName);
  });

  it('should log out and reject subsequent protected requests', async () => {
    const regRes = await request(app).post('/api/v1/auth/register').send(validUser).expect(201);
    const cookie = regRes.headers['set-cookie'];

    // Logout
    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', cookie)
      .expect(200);

    const clearedCookie = logoutRes.headers['set-cookie'];
    expect(clearedCookie.some((c: string) => c.includes('syncnshare_session=;'))).toBe(true);

    // Protected call without valid cookie should be rejected
    await request(app).get('/api/v1/auth/me').expect(401);
  });
});

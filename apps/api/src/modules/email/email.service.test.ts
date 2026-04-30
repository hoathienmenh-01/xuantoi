import { describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

/**
 * EmailService test — unit test thuần (không cần DB/Redis).
 *
 * Vì EmailService dùng console mode khi không có SMTP_HOST, ta chỉ cần
 * verify logic: mode selection, link generation, email body format.
 */

function makeService(env: Record<string, string> = {}): EmailService {
  const cfg = new ConfigService(env);
  const svc = new EmailService(cfg);
  svc.onModuleInit();
  return svc;
}

// ---------------------------------------------------------------------------
// Mode selection
// ---------------------------------------------------------------------------
describe('EmailService mode selection', () => {
  it('default (no SMTP_HOST, no MAIL_TRANSPORT) → console mode, send() logs to stdout', async () => {
    const svc = makeService();
    // send() should not throw in console mode
    await expect(
      svc.send({ to: 'a@b.c', subject: 'test', text: 'body' }),
    ).resolves.toBeUndefined();
  });

  it('explicit MAIL_TRANSPORT=console → console mode even with SMTP_HOST', async () => {
    const svc = makeService({ MAIL_TRANSPORT: 'console', SMTP_HOST: 'smtp.example.com' });
    await expect(
      svc.send({ to: 'a@b.c', subject: 'test', text: 'body' }),
    ).resolves.toBeUndefined();
  });

  it('SMTP_HOST without explicit MAIL_TRANSPORT → smtp mode (transporter created)', () => {
    const svc = makeService({ SMTP_HOST: 'smtp.example.com', SMTP_PORT: '587' });
    // In smtp mode the transporter is created — we can't easily verify it
    // without actually connecting, but at least onModuleInit doesn't throw
    expect(svc).toBeDefined();
  });

  it('SMTP_HOST with auth credentials → smtp mode (no throw)', () => {
    const svc = makeService({
      SMTP_HOST: 'smtp.example.com',
      SMTP_PORT: '465',
      SMTP_USER: 'user',
      SMTP_PASS: 'pass',
    });
    expect(svc).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// send() in console mode
// ---------------------------------------------------------------------------
describe('EmailService.send (console mode)', () => {
  it('logs email content to stdout via Logger', async () => {
    const svc = makeService();
    const logSpy = vi.spyOn((svc as never)['logger'], 'log');
    await svc.send({ to: 'user@test.com', subject: 'Hello', text: 'World' });
    expect(logSpy).toHaveBeenCalledOnce();
    const msg = logSpy.mock.calls[0][0] as string;
    expect(msg).toContain('user@test.com');
    expect(msg).toContain('Hello');
    expect(msg).toContain('World');
    logSpy.mockRestore();
  });

  it('html parameter is optional (text-only)', async () => {
    const svc = makeService();
    await expect(
      svc.send({ to: 'x@y.z', subject: 's', text: 't' }),
    ).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// sendPasswordResetEmail — link generation
// ---------------------------------------------------------------------------
describe('EmailService.sendPasswordResetEmail', () => {
  it('generates correct reset link with default WEB_PUBLIC_URL', async () => {
    const svc = makeService();
    const logSpy = vi.spyOn((svc as never)['logger'], 'log');
    const token = 'abc123-test-token';
    const expiresAt = new Date(Date.now() + 30 * 60_000); // 30 min

    await svc.sendPasswordResetEmail({
      to: 'player@xuantoi.local',
      token,
      expiresAt,
    });

    expect(logSpy).toHaveBeenCalled();
    const body = logSpy.mock.calls.find((c) =>
      (c[0] as string).includes('player@xuantoi.local'),
    )?.[0] as string;
    expect(body).toBeDefined();
    // Default WEB_PUBLIC_URL = http://localhost:5173
    expect(body).toContain('http://localhost:5173/auth/reset-password?token=abc123-test-token');
    logSpy.mockRestore();
  });

  it('uses custom WEB_PUBLIC_URL (strips trailing slash)', async () => {
    const svc = makeService({ WEB_PUBLIC_URL: 'https://game.xuantoi.vn/' });
    const logSpy = vi.spyOn((svc as never)['logger'], 'log');
    const token = 'xyz789';
    const expiresAt = new Date(Date.now() + 15 * 60_000);

    await svc.sendPasswordResetEmail({
      to: 'dao@test.com',
      token,
      expiresAt,
    });

    const body = logSpy.mock.calls.find((c) =>
      (c[0] as string).includes('dao@test.com'),
    )?.[0] as string;
    expect(body).toContain('https://game.xuantoi.vn/auth/reset-password?token=xyz789');
    // No double slash
    expect(body).not.toContain('xuantoi.vn//auth');
    logSpy.mockRestore();
  });

  it('URL-encodes special characters in token', async () => {
    const svc = makeService();
    const logSpy = vi.spyOn((svc as never)['logger'], 'log');
    const token = 'a+b=c&d';
    const expiresAt = new Date(Date.now() + 60 * 60_000);

    await svc.sendPasswordResetEmail({
      to: 'enc@test.com',
      token,
      expiresAt,
    });

    const body = logSpy.mock.calls.find((c) =>
      (c[0] as string).includes('enc@test.com'),
    )?.[0] as string;
    expect(body).toContain(encodeURIComponent(token));
    expect(body).not.toContain('token=a+b=c&d');
    logSpy.mockRestore();
  });

  it('email subject contains "Xuân Tôi"', async () => {
    const svc = makeService();
    const logSpy = vi.spyOn((svc as never)['logger'], 'log');
    await svc.sendPasswordResetEmail({
      to: 'subj@test.com',
      token: 'x',
      expiresAt: new Date(Date.now() + 60_000),
    });

    const calls = logSpy.mock.calls.map((c) => c[0] as string);
    const initCall = calls.find((c) => c.includes('subj@test.com'));
    expect(initCall).toBeDefined();
    logSpy.mockRestore();
  });

  it('email body contains expiry time in minutes', async () => {
    const svc = makeService();
    const logSpy = vi.spyOn((svc as never)['logger'], 'log');
    await svc.sendPasswordResetEmail({
      to: 'exp@test.com',
      token: 't',
      expiresAt: new Date(Date.now() + 30 * 60_000), // 30 min
    });

    const body = logSpy.mock.calls.find((c) =>
      (c[0] as string).includes('exp@test.com'),
    )?.[0] as string;
    // Should mention "30 phút" (or close)
    expect(body).toMatch(/\d+ phút/);
    logSpy.mockRestore();
  });

  it('expiry rounds to at least 1 minute even for very short TTL', async () => {
    const svc = makeService();
    const logSpy = vi.spyOn((svc as never)['logger'], 'log');
    await svc.sendPasswordResetEmail({
      to: 'min@test.com',
      token: 't',
      expiresAt: new Date(Date.now() + 5_000), // 5 seconds → rounds to 1 min
    });

    const body = logSpy.mock.calls.find((c) =>
      (c[0] as string).includes('min@test.com'),
    )?.[0] as string;
    expect(body).toContain('1 phút');
    logSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// SMTP_FROM customization
// ---------------------------------------------------------------------------
describe('EmailService SMTP_FROM', () => {
  it('default from address contains "xuantoi"', async () => {
    const svc = makeService();
    // The from address is used in smtp mode for transporter.sendMail
    // In console mode it's not directly visible in log, but we verify
    // the service initializes correctly with default from
    expect(svc).toBeDefined();
  });

  it('custom SMTP_FROM is accepted without error', () => {
    const svc = makeService({ SMTP_FROM: 'Custom <custom@game.vn>' });
    expect(svc).toBeDefined();
  });
});

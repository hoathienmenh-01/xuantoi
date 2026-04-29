import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

/**
 * SMTP email service (transactional mail) — khác với in-game `MailModule`
 * (thư trong game). Dùng cho password reset, system notifications, v.v.
 *
 * Cấu hình (env):
 * - `SMTP_HOST` — bắt buộc nếu muốn gửi mail thật (Mailhog dev: `localhost`).
 * - `SMTP_PORT` — mặc định `1025` (Mailhog).
 * - `SMTP_USER` / `SMTP_PASS` — optional (Mailhog không yêu cầu).
 * - `SMTP_FROM` — địa chỉ "From" hiển thị; mặc định `noreply@xuantoi.local`.
 * - `MAIL_TRANSPORT` — `"smtp"` (mặc định nếu có `SMTP_HOST`) hoặc
 *   `"console"` (dev/test/CI: log ra stdout, không kết nối SMTP).
 *
 * Trong test/CI không set `SMTP_HOST` → tự động fallback `console` để CI
 * không cần Mailhog container chạy. Production phải set `SMTP_HOST`.
 */
@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private mode: 'smtp' | 'console' = 'console';
  private from = 'Xuân Tôi <noreply@xuantoi.local>';

  constructor(private readonly cfg: ConfigService) {}

  onModuleInit(): void {
    const explicit = this.cfg.get<string>('MAIL_TRANSPORT');
    const host = this.cfg.get<string>('SMTP_HOST');
    const port = Number(this.cfg.get<string>('SMTP_PORT') ?? 1025);
    const user = this.cfg.get<string>('SMTP_USER');
    const pass = this.cfg.get<string>('SMTP_PASS');
    this.from = this.cfg.get<string>('SMTP_FROM') ?? this.from;

    if (explicit === 'console' || (!explicit && !host)) {
      this.mode = 'console';
      this.logger.log(
        'EmailService: mode=console (mail body logged to stdout; set SMTP_HOST + MAIL_TRANSPORT=smtp for real send).',
      );
      return;
    }

    this.mode = 'smtp';
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: false,
      auth: user ? { user, pass } : undefined,
    });
    this.logger.log(`EmailService: mode=smtp host=${host}:${port} from=${this.from}`);
  }

  async send(opts: {
    to: string;
    subject: string;
    text: string;
    html?: string;
  }): Promise<void> {
    if (this.mode === 'console' || !this.transporter) {
      this.logger.log(
        `[email] to=${opts.to} subject="${opts.subject}"\n` +
          `------ BEGIN MAIL BODY ------\n${opts.text}\n------- END MAIL BODY -------`,
      );
      return;
    }
    await this.transporter.sendMail({
      from: this.from,
      to: opts.to,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });
  }

  /**
   * Helper chuyên biệt cho forgot-password: format link từ
   * `WEB_PUBLIC_URL` env (mặc định `http://localhost:5173`) + token.
   */
  async sendPasswordResetEmail(opts: {
    to: string;
    token: string;
    expiresAt: Date;
  }): Promise<void> {
    const base = this.cfg.get<string>('WEB_PUBLIC_URL') ?? 'http://localhost:5173';
    const link = `${base.replace(/\/+$/, '')}/auth/reset-password?token=${encodeURIComponent(opts.token)}`;
    const expiresMin = Math.max(
      1,
      Math.round((opts.expiresAt.getTime() - Date.now()) / 60_000),
    );
    const subject = 'Xuân Tôi — Đặt lại huyền pháp';
    const text = [
      'Đạo hữu kính mến,',
      '',
      'Có yêu cầu đặt lại huyền pháp (mật khẩu) cho tài khoản của đạo hữu trên Xuân Tôi.',
      `Đường dẫn (hiệu lực ${expiresMin} phút):`,
      link,
      '',
      'Nếu đạo hữu không yêu cầu đổi mật khẩu, có thể bỏ qua thư này. Tài khoản vẫn an toàn.',
      '',
      '— Hệ thống Xuân Tôi',
    ].join('\n');
    await this.send({ to: opts.to, subject, text });
  }
}

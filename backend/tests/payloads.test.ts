import { describe, it, expect, beforeAll } from 'vitest';
import { AuthService, registerSchema, loginSchema } from '../src/modules/auth/auth.service.js';
import {
  buttonsMessageSchema,
  listMessageSchema,
  webviewMessageSchema,
  ephemeralSettingSchema,
} from '../src/integrations/zapo/ZapoPayloadValidator.js';

describe('Auth Service Validation', () => {
  it('validates register input properly', () => {
    const valid = registerSchema.safeParse({
      name: 'Yran Dev',
      email: 'yran@example.com',
      password: 'password123',
    });
    expect(valid.success).toBe(true);

    const invalidEmail = registerSchema.safeParse({
      name: 'Yran',
      email: 'not-an-email',
      password: 'password123',
    });
    expect(invalidEmail.success).toBe(false);

    const shortPassword = registerSchema.safeParse({
      name: 'Yran',
      email: 'yran@example.com',
      password: '123',
    });
    expect(shortPassword.success).toBe(false);
  });

  it('validates login input properly', () => {
    const valid = loginSchema.safeParse({
      email: 'yran@example.com',
      password: 'secretpassword',
    });
    expect(valid.success).toBe(true);

    const empty = loginSchema.safeParse({
      email: '',
      password: '',
    });
    expect(empty.success).toBe(false);
  });
});

describe('Zapo Payload Validators', () => {
  it('enforces maximum of 3 buttons in buttonsMessageSchema', () => {
    const valid = buttonsMessageSchema.safeParse({
      contentText: 'Escolha uma opção',
      buttons: [
        { buttonId: '1', displayText: 'Opção 1' },
        { buttonId: '2', displayText: 'Opção 2' },
        { buttonId: '3', displayText: 'Opção 3' },
      ],
    });
    expect(valid.success).toBe(true);

    const excessive = buttonsMessageSchema.safeParse({
      contentText: 'Escolha uma opção',
      buttons: [
        { buttonId: '1', displayText: 'Opção 1' },
        { buttonId: '2', displayText: 'Opção 2' },
        { buttonId: '3', displayText: 'Opção 3' },
        { buttonId: '4', displayText: 'Opção 4' },
      ],
    });
    expect(excessive.success).toBe(false);
  });

  it('validates list messages with sections and rows', () => {
    const valid = listMessageSchema.safeParse({
      title: 'Menu Principal',
      description: 'Selecione abaixo',
      buttonText: 'Ver Lista',
      sections: [
        {
          title: 'Bebidas',
          rows: [{ rowId: 'coca', title: 'Coca-Cola' }],
        },
      ],
    });
    expect(valid.success).toBe(true);
  });

  it('prevents SSRF in Webview URLs', () => {
    const ssrfAttempt = webviewMessageSchema.safeParse({
      bodyText: 'Clique para acessar',
      buttonText: 'Abrir',
      url: 'http://169.254.169.254/latest/meta-data/',
    });
    expect(ssrfAttempt.success).toBe(false);

    const validUrl = webviewMessageSchema.safeParse({
      bodyText: 'Clique para acessar',
      buttonText: 'Abrir',
      url: 'https://zapo.to/en/introduction',
    });
    expect(validUrl.success).toBe(true);
  });

  it('validates ephemeral settings expiration time', () => {
    const valid = ephemeralSettingSchema.safeParse({
      ephemeralExpiration: 86400,
    });
    expect(valid.success).toBe(true);

    const negative = ephemeralSettingSchema.safeParse({
      ephemeralExpiration: -10,
    });
    expect(negative.success).toBe(false);
  });
});

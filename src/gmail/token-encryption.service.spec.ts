import { ConfigService } from '@nestjs/config';
import { TokenEncryptionService } from './token-encryption.service.js';

describe('TokenEncryptionService', () => {
  const key = 'a'.repeat(64);
  const service = new TokenEncryptionService({
    getOrThrow: () => key,
  } as unknown as ConfigService);

  it('encrypts tokens and decrypts them back', () => {
    const encrypted = service.encrypt('sensitive-google-token');
    expect(encrypted).not.toContain('sensitive-google-token');
    expect(service.decrypt(encrypted)).toBe('sensitive-google-token');
  });

  it('rejects altered ciphertext', () => {
    const [iv, tag, ciphertext] = service.encrypt('sensitive-google-token').split('.');
    const alteredCiphertext = (ciphertext![0] === 'a' ? 'b' : 'a') + ciphertext!.slice(1);
    const altered = `${iv}.${tag}.${alteredCiphertext}`;
    expect(() => service.decrypt(altered)).toThrow();
  });
});

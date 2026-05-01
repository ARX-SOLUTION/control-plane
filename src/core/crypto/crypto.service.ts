import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import * as crypto from 'crypto';
import { EncryptedData } from './types';

@Injectable()
export class CryptoService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly dekLength = 32;
  private readonly ivLength = 16;
  private readonly saltLength = 32;
  private readonly tagLength = 16;
  private readonly currentKeyVersion = 1;
  private masterKey: Buffer;

  constructor(private readonly configService: ConfigService) {
    const masterKeyHex = this.configService.get('MASTER_KEY');
    if (!masterKeyHex || masterKeyHex.length !== 64) {
      throw new Error('MASTER_KEY must be 32 bytes (64 hex chars)');
    }
    this.masterKey = Buffer.from(masterKeyHex, 'hex');
  }

  encrypt(plaintext: string): EncryptedData {
    // Generate random DEK
    const dek = crypto.randomBytes(this.dekLength);

    // Encrypt plaintext with DEK
    const iv = crypto.randomBytes(this.ivLength);
    const cipher = crypto.createCipheriv(this.algorithm, dek, iv);

    const ciphertextBuffers: Buffer[] = [];
    ciphertextBuffers.push(cipher.update(plaintext, 'utf8'));
    ciphertextBuffers.push(cipher.final());

    const ciphertext = Buffer.concat(ciphertextBuffers);
    const authTag = cipher.getAuthTag();

    // Encrypt DEK with master key
    const dekIv = crypto.randomBytes(this.ivLength);
    const dekCipher = crypto.createCipheriv(
      this.algorithm,
      this.masterKey,
      dekIv,
    );

    const encryptedDekBuffers: Buffer[] = [];
    encryptedDekBuffers.push(dekCipher.update(dek));
    encryptedDekBuffers.push(dekCipher.final());

    const encryptedDek = Buffer.concat(encryptedDekBuffers);
    const dekAuthTag = dekCipher.getAuthTag();

    // Combine encrypted DEK with its IV and auth tag
    const combinedDek = Buffer.concat([dekIv, encryptedDek, dekAuthTag]);

    return {
      ciphertext: ciphertext.toString('base64'),
      encrypted_dek: combinedDek.toString('base64'),
      iv: iv.toString('base64'),
      auth_tag: authTag.toString('base64'),
      key_version: this.currentKeyVersion,
    };
  }

  decrypt(data: EncryptedData): string {
    if (data.key_version !== this.currentKeyVersion) {
      throw new Error(`Unsupported key version: ${data.key_version}`);
    }

    // Parse encrypted DEK components
    const combinedDek = Buffer.from(data.encrypted_dek, 'base64');
    const dekIv = combinedDek.subarray(0, this.ivLength);
    const encryptedDek = combinedDek.subarray(
      this.ivLength,
      combinedDek.length - this.tagLength,
    );
    const dekAuthTag = combinedDek.subarray(
      combinedDek.length - this.tagLength,
    );

    // Decrypt DEK with master key
    const dekDecipher = crypto.createDecipheriv(
      this.algorithm,
      this.masterKey,
      dekIv,
    );
    dekDecipher.setAuthTag(dekAuthTag);

    const dekBuffers: Buffer[] = [];
    dekBuffers.push(dekDecipher.update(encryptedDek));
    dekBuffers.push(dekDecipher.final());

    const dek = Buffer.concat(dekBuffers);

    // Decrypt ciphertext with DEK
    const iv = Buffer.from(data.iv, 'base64');
    const authTag = Buffer.from(data.auth_tag, 'base64');
    const ciphertext = Buffer.from(data.ciphertext, 'base64');

    const decipher = crypto.createDecipheriv(this.algorithm, dek, iv);
    decipher.setAuthTag(authTag);

    const plaintextBuffers: Buffer[] = [];
    plaintextBuffers.push(decipher.update(ciphertext));
    plaintextBuffers.push(decipher.final());

    return Buffer.concat(plaintextBuffers).toString('utf8');
  }

  generateSecureToken(length = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  hashPassword(_password: string): string {
    // This is a placeholder - we already use argon2 in auth.service
    throw new Error('Use argon2 directly for password hashing');
  }
}

import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { anamnesEncryptionKey } from './config';
import { AnamnesError } from './http';

export function encryptIntake(value: unknown, associatedData: string): string {
  const key=anamnesEncryptionKey();
  if (!key) throw new AnamnesError('Säker lagring är inte konfigurerad.',503);
  const iv=randomBytes(12);
  const cipher=createCipheriv('aes-256-gcm',key,iv);
  cipher.setAAD(Buffer.from(associatedData));
  const data=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
  return `v1.${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${data.toString('base64url')}`;
}

export function decryptIntake(value: string, associatedData: string): unknown {
  const key=anamnesEncryptionKey();
  if (!key) throw new AnamnesError('Säker lagring är inte konfigurerad.',503);
  const [version,iv,tag,data,extra]=value.split('.');
  if (version!=='v1' || !iv || !tag || !data || extra) throw new AnamnesError('Underlaget kunde inte öppnas.',503);
  try {
    const decipher=createDecipheriv('aes-256-gcm',key,Buffer.from(iv,'base64url'));
    decipher.setAAD(Buffer.from(associatedData));
    decipher.setAuthTag(Buffer.from(tag,'base64url'));
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data,'base64url')),decipher.final()]).toString('utf8')) as unknown;
  } catch { throw new AnamnesError('Underlaget kunde inte öppnas.',503); }
}

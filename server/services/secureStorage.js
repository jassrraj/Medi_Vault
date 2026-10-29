import crypto from 'crypto';

const algorithm = 'aes-256-gcm';

const masterKey = () => {
  const value = process.env.FILE_ENCRYPTION_MASTER_KEY;
  if (!value || !/^[a-fA-F0-9]{64}$/.test(value)) throw new Error('FILE_ENCRYPTION_MASTER_KEY must be a 64-character hexadecimal key');
  return Buffer.from(value, 'hex');
};

const encrypt = (data, key) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  const ciphertext = Buffer.concat([cipher.update(data), cipher.final()]);
  return { ciphertext, iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64') };
};

const decrypt = (ciphertext, key, iv, tag) => {
  const decipher = crypto.createDecipheriv(algorithm, key, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
};

export const encryptMedicalFile = (fileBuffer) => {
  const fileKey = crypto.randomBytes(32);
  const encryptedFile = encrypt(fileBuffer, fileKey);
  const wrappedKey = encrypt(fileKey, masterKey());
  return {
    encryptedFile: encryptedFile.ciphertext,
    contentHash: crypto.createHash('sha256').update(encryptedFile.ciphertext).digest('hex'),
    keyMetadata: JSON.stringify({ fileIv: encryptedFile.iv, fileTag: encryptedFile.tag, wrappedKey: wrappedKey.ciphertext.toString('base64'), wrappedKeyIv: wrappedKey.iv, wrappedKeyTag: wrappedKey.tag }),
  };
};

export const decryptMedicalFile = (encryptedFile, keyMetadata) => {
  const metadata = JSON.parse(keyMetadata);
  const fileKey = decrypt(Buffer.from(metadata.wrappedKey, 'base64'), masterKey(), metadata.wrappedKeyIv, metadata.wrappedKeyTag);
  return decrypt(encryptedFile, fileKey, metadata.fileIv, metadata.fileTag);
};

import { Firestore } from '@google-cloud/firestore';
import crypto from 'crypto';

const firestore = new Firestore();
const CONFIG_COLLECTION = process.env.CONFIG_COLLECTION || 'config';
const CONFIG_DOC = 'auth';

export async function hashPassword(password: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(16).toString('hex');
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(salt + ":" + derivedKey.toString('hex'));
    });
  });
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const [salt, key] = hash.split(':');
    if (!salt || !key) return resolve(false);
    crypto.scrypt(password, salt, 64, (err, derivedKey) => {
      if (err) reject(err);
      resolve(key === derivedKey.toString('hex'));
    });
  });
}

export async function getAdminPasswordHash(): Promise<string | null> {
  const doc = await firestore.collection(CONFIG_COLLECTION).doc(CONFIG_DOC).get();
  if (doc.exists) {
    const data = doc.data();
    return data?.passwordHash || null;
  }
  return null;
}

export async function setAdminPasswordHash(hash: string): Promise<void> {
  await firestore.collection(CONFIG_COLLECTION).doc(CONFIG_DOC).set({ passwordHash: hash }, { merge: true });
}

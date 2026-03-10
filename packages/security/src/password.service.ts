import crypto from "node:crypto";

const KEY_LENGTH = 64;
const SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1
};

export class PasswordService {
  async hash(password: string): Promise<string> {
    const salt = crypto.randomBytes(16).toString("hex");
    const key = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(password, salt, KEY_LENGTH, SCRYPT_PARAMS, (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey as Buffer);
      });
    });

    return `${salt}:${key.toString("hex")}`;
  }

  async verify(password: string, storedHash: string): Promise<boolean> {
    const [salt, hash] = storedHash.split(":");
    if (!salt || !hash) {
      return false;
    }

    const key = await new Promise<Buffer>((resolve, reject) => {
      crypto.scrypt(password, salt, KEY_LENGTH, SCRYPT_PARAMS, (error, derivedKey) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(derivedKey as Buffer);
      });
    });

    const incoming = Buffer.from(hash, "hex");
    if (incoming.length !== key.length) {
      return false;
    }

    return crypto.timingSafeEqual(incoming, key);
  }
}

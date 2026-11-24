/**
 * KristaId - Identifier utility class
 * Mirrors original toolkit-src/common/KristaId.ts
 */

export enum IdType {
  INBOX = "inbox",
  MESSAGE = "message",
  EXECUTION = "execution",
  ACCOUNT = "account",
  SESSION = "session"
}

export class KristaId {
  constructor(
    public readonly id: string,
    public readonly type?: IdType
  ) {}

  static parse(id: string, type?: IdType): KristaId {
    return new KristaId(id, type);
  }

  static generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  toString(): string {
    return this.id;
  }
}


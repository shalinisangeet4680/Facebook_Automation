import { Readable } from "stream";

export const MEDIA_STORAGE = Symbol("MEDIA_STORAGE");

export interface MediaStorage {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  read(key: string): Promise<{ stream: Readable; size: number } | null>;
  remove(key: string): Promise<void>;
}

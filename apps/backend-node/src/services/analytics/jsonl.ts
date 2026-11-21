import { open, stat } from "node:fs/promises";

const TAIL_BYTES = 8 * 1024 * 1024;

/** The last few MB of a JSON-lines file on the host, parsed. Empty when the file is off or missing. */
export async function readJsonlTail<T>(file: string | null): Promise<T[]> {
  if (!file) return [];
  try {
    const { size } = await stat(file);
    const start = Math.max(0, size - TAIL_BYTES);
    const handle = await open(file, "r");
    try {
      const buffer = Buffer.alloc(size - start);
      await handle.read(buffer, 0, buffer.length, start);
      const lines = buffer.toString("utf8").split("\n");
      if (start > 0) lines.shift(); // probably cut mid-line
      return lines.flatMap((line) => {
        try {
          return line ? [JSON.parse(line) as T] : [];
        } catch {
          return [];
        }
      });
    } finally {
      await handle.close();
    }
  } catch {
    return [];
  }
}

import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const EXCLUDED_DIRS = new Set([
  'node_modules',
  'dist',
  'dev-dist',
  'data',
  '.git',
  '.aistudio',
  'coverage',
  'build',
]);

const EXCLUDED_EXTENSIONS = ['.log', '.pem', '.key'];

function shouldIncludeFile(relPosixPath: string, fileName: string): boolean {
  if (fileName === '.DS_Store') return false;

  // Never include real env/secret files; only allow .env.example
  if (fileName.startsWith('.env') && fileName !== '.env.example') {
    return false;
  }

  for (const ext of EXCLUDED_EXTENSIONS) {
    if (fileName.endsWith(ext)) return false;
  }

  // Exclude lockfiles if unwanted? Keep package.json & bun.lock so dependencies match cleanly
  const segments = relPosixPath.split('/');
  for (const seg of segments.slice(0, -1)) {
    if (EXCLUDED_DIRS.has(seg)) return false;
  }

  return true;
}

function collectFiles(rootDir: string, currentDir = rootDir): { relPath: string; fullPath: string }[] {
  const entries = fs.readdirSync(currentDir, { withFileTypes: true });
  const results: { relPath: string; fullPath: string }[] = [];

  for (const entry of entries) {
    if (entry.isSymbolicLink()) continue;
    const fullPath = path.join(currentDir, entry.name);
    const relPath = path.relative(rootDir, fullPath).split(path.sep).join('/');

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name) || entry.name.startsWith('.')) {
        continue;
      }
      results.push(...collectFiles(rootDir, fullPath));
    } else if (entry.isFile()) {
      if (shouldIncludeFile(relPath, entry.name)) {
        results.push({ relPath, fullPath });
      }
    }
  }

  return results.sort((a, b) => a.relPath.localeCompare(b.relPath));
}

// Standard IEEE 802.3 CRC32 table
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) !== 0 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buf: Buffer): number {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function toDosTimeDate(date: Date): { dosTime: number; dosDate: number } {
  const year = Math.max(1980, date.getFullYear());
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const seconds = Math.floor(date.getSeconds() / 2);

  const dosTime = (hours << 11) | (minutes << 5) | seconds;
  const dosDate = ((year - 1980) << 9) | (month << 5) | day;
  return { dosTime, dosDate };
}

export function buildSourceZipBuffer(rootDir: string): {
  buffer: Buffer;
  fileCount: number;
} {
  const files = collectFiles(rootDir);
  const localChunks: Buffer[] = [];
  const centralChunks: Buffer[] = [];
  let offset = 0;

  for (const file of files) {
    const rawData = fs.readFileSync(file.fullPath);
    const stat = fs.statSync(file.fullPath);
    const { dosTime, dosDate } = toDosTimeDate(stat.mtime);
    const nameBuf = Buffer.from(`smart-absensi-tkit/${file.relPath}`, 'utf8');
    const crc = crc32(rawData);
    const compressed = zlib.deflateRawSync(rawData, { level: 6 });

    const useDeflate = compressed.length < rawData.length;
    const method = useDeflate ? 8 : 0;
    const payload = useDeflate ? compressed : rawData;

    // Local File Header (30 bytes + filename)
    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0); // signature
    localHeader.writeUInt16LE(20, 4); // version needed
    localHeader.writeUInt16LE(0x0800, 6); // UTF-8 flag
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(payload.length, 18);
    localHeader.writeUInt32LE(rawData.length, 22);
    localHeader.writeUInt16LE(nameBuf.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra length

    localChunks.push(localHeader, nameBuf, payload);

    // Central Directory Header (46 bytes + filename)
    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0); // signature
    centralHeader.writeUInt16LE(20, 4); // version made by
    centralHeader.writeUInt16LE(20, 6); // version needed
    centralHeader.writeUInt16LE(0x0800, 8); // UTF-8 flag
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(payload.length, 20);
    centralHeader.writeUInt32LE(rawData.length, 24);
    centralHeader.writeUInt16LE(nameBuf.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra length
    centralHeader.writeUInt16LE(0, 32); // comment length
    centralHeader.writeUInt16LE(0, 34); // disk start
    centralHeader.writeUInt16LE(0, 36); // internal attrs
    centralHeader.writeUInt32LE(0, 38); // external attrs
    centralHeader.writeUInt32LE(offset, 42); // relative offset

    centralChunks.push(centralHeader, nameBuf);
    offset += localHeader.length + nameBuf.length + payload.length;
  }

  const centralDirBuffer = Buffer.concat(centralChunks);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // EOCD signature
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(files.length, 8);
  eocd.writeUInt16LE(files.length, 10);
  eocd.writeUInt32LE(centralDirBuffer.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return {
    buffer: Buffer.concat([...localChunks, centralDirBuffer, eocd]),
    fileCount: files.length,
  };
}

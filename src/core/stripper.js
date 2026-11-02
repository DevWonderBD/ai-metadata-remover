import { detectAI, findAI, latin1 } from './detectAI.js';

export const ascii = (u8, start, n) => latin1(u8.subarray(start, start + n));

export function sniff(u8) {
  if (u8[0] === 0xFF && u8[1] === 0xD8) return 'jpeg';
  if (u8[0] === 0x89 && ascii(u8, 1, 3) === 'PNG') return 'png';
  if (ascii(u8, 0, 4) === 'RIFF' && ascii(u8, 8, 4) === 'WEBP') return 'webp';
  return 'other';
}

function merge(list) {
  const m = new Map();
  for (const r of list) {
    m.set(r.label, (m.get(r.label) || 0) + r.bytes);
  }
  return [...m].map(([label, bytes]) => ({ label, bytes }));
}

function concat(parts) {
  const totalLength = parts.reduce((acc, p) => acc + p.length, 0);
  const out = new Uint8Array(totalLength);
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

/* ==================== JPEG ==================== */
function readOrientation(data) {
  try {
    const t = 6;
    const dv = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const le = ascii(data, t, 2) === 'II';
    const ifd = t + dv.getUint32(t + 4, le);
    const n = dv.getUint16(ifd, le);
    for (let k = 0; k < n; k++) {
      const e = ifd + 2 + k * 12;
      if (dv.getUint16(e, le) === 0x0112) {
        return dv.getUint16(e + 8, le);
      }
    }
  } catch (e) {
    // ignore parse error, fallback to 1
  }
  return 1;
}

function orientationSegment(orientation) {
  return new Uint8Array([
    0xFF, 0xE1, 0x00, 0x22, 0x45, 0x78, 0x69, 0x66, 0x00, 0x00,
    0x4D, 0x4D, 0x00, 0x2A, 0x00, 0x00, 0x00, 0x08, 0x00, 0x01,
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, orientation,
    0x00, 0x00, 0x00, 0x00, 0x00, 0x00
  ]);
}

function findEOI(u8, from) {
  for (let i = from; i < u8.length - 1; i++) {
    if (u8[i] === 0xFF && u8[i + 1] === 0xD9) return i + 2;
  }
  return u8.length;
}

export function stripJPEG(u8, keepICC = true) {
  const out = [u8.subarray(0, 2)];
  const removed = [];
  const meta = [];
  const kept = new Set();
  let i = 2;
  let orientation = 1;
  let insertAt = 1;

  while (i < u8.length) {
    if (u8[i] !== 0xFF) {
      throw new Error('This image seems damaged or invalid JPEG');
    }
    const marker = u8[i + 1];
    if (marker === 0xFF) {
      i++;
      continue;
    }
    if (marker === 0xDA) { // SOS (Start of Scan)
      const end = findEOI(u8, i);
      out.push(u8.subarray(i, end));
      kept.add('Original image, untouched');
      if (end < u8.length) {
        removed.push({ label: 'Extra data hidden at end of file', bytes: u8.length - end });
        meta.push(u8.subarray(end));
      }
      break;
    }
    if (marker === 0xD9) { // EOI (End of Image)
      out.push(u8.subarray(i, i + 2));
      break;
    }
    if ((marker >= 0xD0 && marker <= 0xD7) || marker === 0x01) {
      out.push(u8.subarray(i, i + 2));
      i += 2;
      continue;
    }

    const len = (u8[i + 2] << 8) | u8[i + 3];
    const seg = u8.subarray(i, i + 2 + len);
    const data = u8.subarray(i + 4, i + 2 + len);
    const id = ascii(data, 0, Math.min(40, data.length));
    let keep = true;
    let label = null;

    if (marker === 0xE0) {
      keep = id.startsWith('JFIF') || id.startsWith('JFXX');
      label = 'Other hidden info';
    } else if (marker === 0xE1) {
      keep = false;
      if (id.startsWith('Exif')) {
        label = 'Camera & device details (EXIF/GPS)';
        orientation = readOrientation(data);
      } else {
        label = /adobe\.com\/x(ap|mp)/.test(id) ? 'Hidden file history (XMP)' : 'Other hidden info';
      }
    } else if (marker === 0xE2) {
      const isICC = id.startsWith('ICC_PROFILE');
      keep = isICC && keepICC;
      label = isICC ? 'Color profile (ICC)' : id.startsWith('MPF') ? 'Extra preview images' : 'Other hidden info';
    } else if (marker === 0xEB) {
      keep = false;
      label = 'AI “Content Credentials” label (C2PA)';
    } else if (marker === 0xED) {
      keep = false;
      label = 'Photo tags & captions (IPTC)';
    } else if (marker === 0xEE) {
      keep = id.startsWith('Adobe');
      label = 'Other hidden info';
    } else if (marker >= 0xE3 && marker <= 0xEF) {
      keep = false;
      label = 'Other application markers';
    } else if (marker === 0xFE) {
      keep = false;
      label = 'Hidden comment (COM)';
    }

    if (keep) {
      out.push(seg);
      if (marker === 0xE0 && insertAt === 1) insertAt = out.length;
      if (marker === 0xE2) kept.add('Color profile (ICC)');
      else if (marker === 0xEE) kept.add('Color settings');
      else if (marker === 0xE0) kept.add('Basic JFIF header');
    } else {
      removed.push({ label, bytes: seg.length });
      meta.push(seg);
    }
    i += 2 + len;
  }

  if (orientation > 1 && orientation <= 8) {
    out.splice(insertAt, 0, orientationSegment(orientation));
    kept.add('Photo rotation / orientation');
  }

  return {
    bytes: concat(out),
    removed: merge(removed),
    kept: [...kept],
    meta: concat(meta),
  };
}

/* ==================== PNG ==================== */
const PNG_KEEP = new Set([
  'IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'gAMA', 'cHRM', 'sRGB', 'sBIT',
  'pHYs', 'bKGD', 'acTL', 'fcTL', 'fdAT', 'cICP', 'mDCv', 'cLLi'
]);

const PNG_LABEL = {
  tEXt: 'AI prompt & generation settings (tEXt)',
  iTXt: 'AI prompt & generation settings (iTXt)',
  zTXt: 'AI prompt & generation settings (zTXt)',
  eXIf: 'Camera & device details (eXIf)',
  caBX: 'AI “Content Credentials” label (caBX)',
  tIME: 'Date & time stamp',
  iCCP: 'Color profile (iCCP)',
};

export function stripPNG(u8, keepICC = true) {
  const out = [u8.subarray(0, 8)];
  const removed = [];
  const meta = [];
  const kept = new Set(['Original image, untouched']);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let i = 8;

  while (i + 12 <= u8.length) {
    const len = dv.getUint32(i);
    const type = ascii(u8, i + 4, 4);
    const chunk = u8.subarray(i, i + 12 + len);

    if (PNG_KEEP.has(type) || (type === 'iCCP' && keepICC)) {
      out.push(chunk);
      if (/iCCP|sRGB|gAMA|cHRM|cICP/.test(type)) kept.add('Color profile');
      else if (/acTL|fcTL|fdAT/.test(type)) kept.add('Animation');
      else if (type === 'tRNS') kept.add('Transparency');
    } else {
      let label = PNG_LABEL[type] || 'Other hidden info';
      if (/^(tEXt|iTXt|zTXt)$/.test(type) && !detectAI(chunk).length) {
        label = 'Hidden text chunk';
      }
      removed.push({ label, bytes: chunk.length });
      meta.push(chunk);
    }
    i += 12 + len;
    if (type === 'IEND') break;
  }

  if (i < u8.length) {
    removed.push({ label: 'Extra data hidden at end of file', bytes: u8.length - i });
    meta.push(u8.subarray(i));
  }

  return {
    bytes: concat(out),
    removed: merge(removed),
    kept: [...kept],
    meta: concat(meta),
  };
}

/* ==================== WebP ==================== */
const WEBP_KEEP = new Set(['VP8 ', 'VP8L', 'VP8X', 'ALPH', 'ANIM', 'ANMF']);

export function stripWEBP(u8, keepICC = true) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const total = Math.min(u8.length, 8 + dv.getUint32(4, true));
  const parts = [];
  const removed = [];
  const meta = [];
  const kept = new Set(['Original image, untouched']);
  let i = 12;
  let hasICC = false;

  while (i + 8 <= total) {
    const type = ascii(u8, i, 4);
    const size = dv.getUint32(i + 4, true);
    const chunk = u8.subarray(i, Math.min(total, i + 8 + size + (size & 1)));

    if (WEBP_KEEP.has(type) || (type === 'ICCP' && keepICC)) {
      if (type === 'ICCP') {
        hasICC = true;
        kept.add('Color profile');
      }
      if (type === 'ANIM') kept.add('Animation');
      if (type === 'ALPH') kept.add('Transparency');
      parts.push(type === 'VP8X' ? chunk.slice() : chunk);
    } else {
      removed.push({
        label: { EXIF: 'Camera & device details', 'XMP ': 'Hidden file history (XMP)', ICCP: 'Color profile' }[type] || 'Other hidden info',
        bytes: chunk.length,
      });
      meta.push(chunk);
    }
    i += 8 + size + (size & 1);
  }

  const vp8x = parts.find(p => ascii(p, 0, 4) === 'VP8X');
  if (vp8x) {
    vp8x[8] &= ~(0x08 | 0x04); // clear EXIF and XMP bits
    if (!hasICC) vp8x[8] &= ~0x20; // clear ICC bit
  }

  const body = concat(parts);
  const head = new Uint8Array(12);
  head.set([0x52, 0x49, 0x46, 0x46]); // 'RIFF'
  new DataView(head.buffer).setUint32(4, 4 + body.length, true);
  head.set([0x57, 0x45, 0x42, 0x50], 8); // 'WEBP'

  return {
    bytes: concat([head, body]),
    removed: merge(removed),
    kept: [...kept],
    meta: concat(meta),
  };
}

/* ==================== Canvas Re-encoding Fallback ==================== */
export async function reencode(file, u8) {
  const bmp = await createImageBitmap(new Blob([u8], { type: file.type || '' }));
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  c.getContext('2d').drawImage(bmp, 0, 0);
  if (bmp.close) bmp.close();

  const isLossy = /avif|heic|heif/i.test(file.type + file.name);
  const mime = isLossy ? 'image/jpeg' : 'image/png';
  const blob = await new Promise(res => c.toBlob(res, mime, 0.95));
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    mime,
    ext: isLossy ? 'jpg' : 'png',
  };
}

/* ==================== Unique Noise Injection ==================== */
export function addNoise(img) {
  const d = img.data;
  const rnd = new Uint8Array(65536);
  for (let i = 0, k = 65536; i < d.length; i += 4, k++) {
    if (k >= 65536) {
      crypto.getRandomValues(rnd);
      k = 0;
    }
    const r = rnd[k];
    if ((r & 3) !== 0 || d[i + 3] === 0) continue; // ~25% of visible pixels
    const ch = i + ((r >> 2) % 3);
    const v = d[ch] + ((r & 32) ? 1 : -1);
    d[ch] = v < 0 ? 1 : v > 255 ? 254 : v; // ±1 subtle change
  }
}

export async function makeUnique(u8, mime) {
  const bmp = await createImageBitmap(new Blob([u8], { type: mime }));
  const c = document.createElement('canvas');
  c.width = bmp.width;
  c.height = bmp.height;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(bmp, 0, 0);
  if (bmp.close) bmp.close();

  const img = ctx.getImageData(0, 0, c.width, c.height);
  addNoise(img);
  ctx.putImageData(img, 0, 0);

  let blob = await new Promise(r => c.toBlob(r, mime, mime === 'image/png' ? undefined : 0.95));
  if (!blob || blob.type !== mime) {
    mime = 'image/png';
    blob = await new Promise(r => c.toBlob(r, mime));
  }
  return { bytes: new Uint8Array(await blob.arrayBuffer()), mime };
}

/* ==================== High-Level Clean Dispatcher ==================== */
const STRIPPERS = {
  jpeg: [stripJPEG, 'image/jpeg', 'jpg'],
  png: [stripPNG, 'image/png', 'png'],
  webp: [stripWEBP, 'image/webp', 'webp'],
};

export async function cleanBytes(u8, file, options = { keepICC: true, unique: false }) {
  const kind = sniff(u8);
  if (STRIPPERS[kind]) {
    const [stripFn, mime, ext] = STRIPPERS[kind];
    const r = stripFn(u8, options.keepICC);
    const check = stripFn(r.bytes, options.keepICC);
    const origExt = (file.name.match(/\.([^.]+)$/) || [])[1];

    const out = {
      bytes: r.bytes,
      mime,
      ext: origExt && /^(jpe?g|png|webp)$/i.test(origExt) ? origExt : ext,
      removed: r.removed,
      kept: r.kept,
      ai: findAI(r.meta),
      verified: detectAI(check.meta).length === 0,
      method: 'lossless (same quality)',
    };

    if (options.unique && !r.kept.includes('Animation')) {
      const u = await makeUnique(r.bytes, mime);
      if (u.mime !== mime) out.ext = 'png';
      Object.assign(out, {
        bytes: u.bytes,
        mime: u.mime,
        method: 'unique copy (hash altered)',
        verified: out.verified && detectAI(u.bytes).length === 0,
        removed: [...out.removed, { label: 'Exact image hash/fingerprint (altered)', bytes: null }],
        kept: ['Your image (imperceptible pixel changes)', ...r.kept.filter(k => !/^Original image|Color profile/.test(k))],
      });
    }
    return out;
  }

  // Fallback for HEIC, AVIF, GIF, BMP, TIFF
  const ai = findAI(u8.length < 4e6 ? u8 : u8.subarray(0, 4e6));
  const r = await reencode(file, u8);
  const out = {
    ...r,
    removed: [{ label: 'All container metadata (saved as clean copy)', bytes: null }],
    kept: ['Your image'],
    ai,
    verified: true,
    method: 'clean fresh copy',
  };

  if (options.unique) {
    const u = await makeUnique(r.bytes, r.mime);
    Object.assign(out, {
      bytes: u.bytes,
      mime: u.mime,
      method: 'unique copy',
      kept: ['Your image (imperceptible pixel changes)'],
      removed: [...out.removed, { label: 'Exact image hash/fingerprint (altered)', bytes: null }],
    });
  }

  return out;
}


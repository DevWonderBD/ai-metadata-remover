/**
 * AI Metadata and Trace Detector
 * Searches binary and text segments for known AI model signatures and provenance tags.
 */

export const AI_PATTERNS = [
  ['AI “Content Credentials” label', /c2pa|jumb|contentauth|claim_generator/i],
  ['“Made with AI” tag', /trainedAlgorithmicMedia|ai[- ]generated|generative ai|made with ai/i],
  ['Midjourney', /midjourney/i],
  ['OpenAI / ChatGPT', /openai|dall[-·\u00b7 ]?e|chatgpt|gpt-4o|sora/i],
  ['Adobe Firefly', /firefly/i],
  ['Google AI', /gemini|\bimagen\b|synthid|google ai/i],
  ['Stable Diffusion prompt', /stable.?diffusion|negative prompt|sampler:|cfg scale/i],
  ['ComfyUI workflow', /comfyui|"class_type"/i],
  ['Other AI tool (Flux, Leonardo, Ideogram…)', /\bflux\b|leonardo\.ai|ideogram|runwayml|\bgrok\b/i],
];

export function latin1(u8) {
  let s = '';
  for (let i = 0; i < u8.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
  }
  return s;
}

export function snippet(s, i, n) {
  const isPrintable = c => c >= 32 && c < 127;
  let a = i, b = i + n;
  while (a > 0 && i - a < 50 && isPrintable(s.charCodeAt(a - 1))) a--;
  while (b < s.length && b - (i + n) < 50 && isPrintable(s.charCodeAt(b))) b++;
  const pre = a > 0 && isPrintable(s.charCodeAt(a - 1)) ? '…' : '';
  const post = b < s.length && isPrintable(s.charCodeAt(b)) ? '…' : '';
  return pre + s.slice(a, b).trim() + post;
}

/**
 * Scans input text or uint8 buffer for AI signatures.
 * @param {string | Uint8Array} input 
 * @returns {Array<{ name: string, evidence: string[] }>}
 */
export function findAI(input) {
  const s = typeof input === 'string' ? input : latin1(input);
  const results = [];
  for (const [name, re] of AI_PATTERNS) {
    const g = new RegExp(re.source, 'gi');
    const evidenceSet = new Set();
    let m;
    while ((m = g.exec(s)) && evidenceSet.size < 3) {
      evidenceSet.add(snippet(s, m.index, m[0].length));
      if (!m[0].length) g.lastIndex++;
    }
    if (evidenceSet.size > 0) {
      results.push({ name, evidence: [...evidenceSet] });
    }
  }
  return results;
}

export function detectAI(input) {
  return findAI(input).map(d => d.name);
}

export function detectFileNameAI(filename) {
  return detectAI(filename);
}

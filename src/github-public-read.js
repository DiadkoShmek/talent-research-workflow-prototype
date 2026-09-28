// One outbound policy for explicit, read-only GitHub collection and source inspection.
export async function readPublicGitHubJson(fetcher, url, limit = 2 * 1024 * 1024) {
  if (typeof fetcher !== 'function' || !Number.isSafeInteger(limit) || limit < 1 || limit > 2 * 1024 * 1024)
    throw new TypeError('invalid GitHub read');
  const target = new URL(url);
  if (target.origin !== 'https://api.github.com' || !/^\/repos\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/commits(?:\/[0-9a-f]{40}(?:[0-9a-f]{24})?)?$/.test(target.pathname))
    throw new TypeError('invalid GitHub read');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const response = await fetcher(url, {
      method: 'GET', credentials: 'omit', redirect: 'error', cache: 'no-store', signal: controller.signal,
      headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }
    });
    if (!response || response.redirected || (response.url && response.url !== url)) throw new Error('redirect refused');
    if (!response.ok) {
      const error = new Error('HTTP failure');
      error.publicStatus = response.status;
      throw error;
    }
    const header = response.headers?.get?.('content-length');
    if (header != null && (!/^\d+$/.test(header) || Number(header) > limit)) throw new Error('response exceeds size limit');
    let bytes;
    if (response.body?.getReader) {
      const reader = response.body.getReader();
      const chunks = [];
      let size = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > limit) {
          await reader.cancel();
          throw new Error('response exceeds size limit');
        }
        chunks.push(value);
      }
      bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    } else {
      const buffer = await response.arrayBuffer();
      if (buffer.byteLength > limit) throw new Error('response exceeds size limit');
      bytes = new Uint8Array(buffer);
    }
    try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
    catch { throw new Error('invalid JSON response'); }
  } finally { clearTimeout(timer); }
}

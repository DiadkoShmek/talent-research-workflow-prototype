import { MAX_SESSION_BYTES, restoreSession, serializeSession } from './session-file.js?v=0.9.0';

export const SESSION_STORAGE_KEY = 'signal-desk.session.v1';

// The adapter is injectable so storage denial, corruption and concurrent changes
// can be tested without a browser. It detects observed changes, not atomic CAS.
export function sessionStore(storage) {
  let expected;
  let loaded = false;
  let valid = false;
  return {
    load() {
      expected = storage.getItem(SESSION_STORAGE_KEY);
      loaded = true;
      valid = false;
      if (expected === null) { valid = true; return null; }
      if (new TextEncoder().encode(expected).byteLength > MAX_SESSION_BYTES) throw Error('stored session exceeds size limit');
      const result = restoreSession(JSON.parse(expected));
      valid = true;
      return result;
    },
    save(originProject, state) {
      if (!loaded || !valid) throw Error('stored session was not loaded successfully');
      const next = JSON.stringify(serializeSession(originProject, state));
      if (storage.getItem(SESSION_STORAGE_KEY) !== expected) throw Error('stored session changed in another tab');
      storage.setItem(SESSION_STORAGE_KEY, next);
      expected = next;
    }
  };
}

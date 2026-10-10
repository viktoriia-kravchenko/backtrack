// Talks to the bank server (bank/server.js). Same idea as api() in the old app.js.
export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error?.message || `Request failed (${res.status})`);
    err.code = data.error?.code;
    throw err;
  }
  return data;
}
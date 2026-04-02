// Safe wrapper around fetch that always resolves to { ok, status, data }
// Prevents "Unexpected end of JSON input" when backend returns empty or non-JSON body.
export async function apiFetch(url: string, options?: RequestInit) {
  const res = await fetch(url, options);

  let data: any = null;
  const text = await res.text();

  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      // Backend returned non-JSON (HTML error page, empty body, etc.)
      data = { error: `Server error (${res.status}): ${text.slice(0, 120)}` };
    }
  }

  return { ok: res.ok, status: res.status, data };
}

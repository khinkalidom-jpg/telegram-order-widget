export class TelegramError extends Error {
  constructor(code, retryAfter = 0) { super(`Telegram request failed (${code})`); this.code = code; this.retryAfter = retryAfter; }
}
export function createApi(token) {
  return async (method, body, timeout = 8000) => {
    let response;
    try {
      response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify(body), signal:AbortSignal.timeout(timeout)});
    } catch { throw new TelegramError('network-or-timeout'); }
    let data;
    try { data = await response.json(); } catch { throw new TelegramError(response.status); }
    if (!response.ok || !data.ok) throw new TelegramError(data.error_code || response.status, data.parameters?.retry_after || 0);
    return data.result;
  };
}

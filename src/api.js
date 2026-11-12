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
    if (!response.ok || !data.ok) { const e = new TelegramError(data.error_code || response.status, data.parameters?.retry_after || 0); e.reason = /blocked/i.test(data.description||'')?'bot-blocked':/chat not found/i.test(data.description||'')?'chat-not-found':/forbidden/i.test(data.description||'')?'forbidden':/query.*(old|invalid)/i.test(data.description||'')?'expired-query':'telegram-rejected'; e.httpStatus=response.status; e.notModified = /message is not modified/i.test(data.description || ""); throw e; }
    return data.result;
  };
}

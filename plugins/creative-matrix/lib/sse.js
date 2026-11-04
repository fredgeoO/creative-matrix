// Minimal Server-Sent Events framing used by the Host route and its tests.

export function sseFrame(event, data) {
  const payload = typeof data === 'string' ? data : JSON.stringify(data)
  return `event: ${event}\ndata: ${payload}\n\n`
}

export function sseComment(text) {
  return `: ${String(text).replace(/\r?\n/g, ' ')}\n\n`
}

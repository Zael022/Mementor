// Doble local del API de mensajes de Anthropic para las pruebas en navegador (sin clave ni costo).
// Responde citando las fuentes que recibe; con stream: true emite eventos SSE como el API real.
import http from 'node:http';
const port = Number(process.argv[2] || 4599);
const log = [];
function answerFor(body) {
  const last = body.messages.at(-1);
  const text = typeof last.content === 'string' ? last.content : last.content.map((b) => b.text || '').join('');
  const ids = [...text.matchAll(/<fuente id="(S\d+)"/g)].map((m) => m[1]);
  const titles = [...text.matchAll(/titulo="([^"]+)"/g)].map((m) => m[1]);
  const first = ids[0] || 'S1';
  const snippet = (text.split(/<fuente[^>]*>\n?/)[1] || '').split('</fuente>')[0].replace(/\s+/g, ' ').slice(0, 160);
  return { ids, titles, first, snippet };
}
http.createServer((req, res) => {
  // /__log devuelve cuántas llamadas recibió (las pruebas comprueban que un aviso no llama al modelo).
  if (req.url === '/__log') { res.end(JSON.stringify(log)); return; }
  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', async () => {
    const body = JSON.parse(raw || '{}');
    const { first, snippet, ids } = answerFor(body);
    log.push({ stream: Boolean(body.stream), sources: ids.length, at: Date.now() });
    const usage = { input_tokens: 420, output_tokens: 64 };
    if (!body.stream) {
      await new Promise((r) => setTimeout(r, Number(process.env.FAKE_JSON_DELAY_MS || 0)));
      const json = JSON.stringify({ answer: `Según el material: ${snippet}`, citedSourceIds: ids.slice(0, 3), grounded: true });
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ id: 'msg_doble', type: 'message', role: 'assistant', model: body.model, content: [{ type: 'text', text: json }], stop_reason: 'end_turn', usage }));
      return;
    }
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
    const send = (event, data) => res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    send('message_start', { type: 'message_start', message: { id: 'msg_doble', type: 'message', role: 'assistant', model: body.model, content: [], usage: { input_tokens: usage.input_tokens, output_tokens: 1 } } });
    send('content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } });
    const cites = ids.slice(0, 3).map((id) => `[${id}]`).join(' ');
    const words = `Según el material del curso, ${snippet} ${cites || `[${first}]`}`.split(' ');
    let closed = false;
    res.on('close', () => { if (!res.writableFinished) closed = true; });
    for (const word of words) {
      if (closed) return;
      send('content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: `${word} ` } });
      await new Promise((r) => setTimeout(r, Number(process.env.FAKE_DELAY_MS || 80)));
    }
    send('content_block_stop', { type: 'content_block_stop', index: 0 });
    send('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null }, usage: { output_tokens: usage.output_tokens } });
    send('message_stop', { type: 'message_stop' });
    res.end();
  });
}).listen(port, '127.0.0.1', () => console.log(`doble de Anthropic en ${port}`));

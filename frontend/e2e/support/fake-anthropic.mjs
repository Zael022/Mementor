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
// Respuestas de ejemplo para los agentes (se reconocen por su instrucción de sistema).
function agentReply(system) {
  const s = String(system || '');
  if (s.includes('diseñador de evaluaciones')) return { questions: [
    { prompt: '¿Por qué el denominador no puede ser cero?', options: ['Porque no se divide un entero en cero partes', 'Porque siempre es par', 'Porque es negativo'], correctIndex: 0, explanation: 'Así lo explica la lección.', citations: ['S1'] },
    { prompt: '¿Qué indica el numerador?', options: ['Cuántas partes se toman', 'En cuántas partes se divide'], correctIndex: 0, explanation: 'Definición de la lección.', citations: ['S1'] },
  ] };
  if (s.includes('retroalimentación formativa')) return { strengths: ['Usa un ejemplo cotidiano'], improvements: ['Explicar el papel del denominador'], feedback: 'Buen ejemplo. Agrega por qué el denominador no puede ser cero.', suggestedPoints: 8 };
  if (s.includes('analista educativo')) return { summary: 'El grupo muestra participación constante; el tema de fracciones necesita refuerzo.', highlights: ['Todos los estudiantes entregaron'], risks: ['Promedio bajo en equivalencias'], recommendations: ['Repasar fracciones equivalentes con material visual'] };
  if (s.includes('oficial de cumplimiento')) return { riskLevel: 'alto', issues: [{ type: 'cédula', detail: 'El texto incluye una cédula completa.', fix: 'Quitarla o mostrar solo las iniciales.' }], summary: 'Contiene datos personales que no deben publicarse.' };
  if (s.includes('redactor educativo')) return { title: 'Recordatorio: quiz del viernes', body: 'Hola a todos: este viernes tenemos el quiz de fracciones. Repasen la lección y practiquen en la racha diaria.', hashtags: ['#Fracciones', '#MentorAI'] };
  if (s.includes('coach de estudio')) return { plan: [{ minutes: 15, activity: 'Repasar fracciones equivalentes', why: 'Es tu tema con menor dominio' }, { minutes: 15, activity: 'Completar la práctica del día', why: 'Mantiene tu racha' }], motivation: '¡Vas muy bien! Media hora hoy suma mucho.' };
  if (s.includes('tutor que sintetiza')) return { summary: 'Las fracciones representan partes de un entero.', keyPoints: ['El numerador indica las partes tomadas', 'El denominador no puede ser cero'], selfCheck: [{ question: '¿Qué indica el denominador?', answer: 'En cuántas partes iguales se divide el entero.' }] };
  return null;
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
      const agent = agentReply(body.system);
      const json = JSON.stringify(agent ?? { answer: `Según el material: ${snippet}`, citedSourceIds: ids.slice(0, 3), grounded: true });
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

import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readTrustProxy } from '../src/config/proxy.js';

// TRUST_PROXY decide si Express confía en X-Forwarded-For para conocer la IP real.
test('TRUST_PROXY acepta saltos y direcciones, y rechaza confiar en cualquiera', () => {
  assert.equal(readTrustProxy(''), null);
  assert.equal(readTrustProxy('false'), null);
  assert.equal(readTrustProxy('1'), 1);
  assert.equal(readTrustProxy('loopback, 10.0.0.0/8'), 'loopback,10.0.0.0/8');
  assert.throws(() => readTrustProxy('true'), /no es seguro/);
  assert.throws(() => readTrustProxy('cualquiera'), /no es válido/);
});

test('con TRUST_PROXY=1 cada cliente detrás del proxy se identifica por su propia IP', () => {
  // Proceso aparte para cargar la app con otra configuración sin afectar al resto de las pruebas.
  const script = `
    const { default: app } = await import('./src/app.js');
    const express = (await import('express')).default;
    const probe = express();
    probe.set('trust proxy', app.get('trust proxy'));
    probe.get('/ip', (req, res) => res.json({ ip: req.ip }));
    const server = probe.listen(0);
    const url = 'http://127.0.0.1:' + server.address().port + '/ip';
    const a = await (await fetch(url, { headers: { 'x-forwarded-for': '203.0.113.5' } })).json();
    const b = await (await fetch(url, { headers: { 'x-forwarded-for': '198.51.100.7' } })).json();
    console.log(JSON.stringify({ setting: app.get('trust proxy'), a: a.ip, b: b.ip }));
    server.close();
    process.exit(0);
  `;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
    cwd: new URL('..', import.meta.url), env: { ...process.env, TRUST_PROXY: '1' }, encoding: 'utf8',
  });
  const result = JSON.parse(output.trim().split('\n').pop());
  assert.equal(result.setting, 1);
  assert.equal(result.a, '203.0.113.5');
  assert.equal(result.b, '198.51.100.7');
});

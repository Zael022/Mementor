// Lee TRUST_PROXY para que Express conozca la IP real del cliente detrás de un proxy.
// Valores: vacío (sin proxy), un número de saltos (1 para un balanceador), o
// loopback, linklocal, uniquelocal y direcciones o rangos IP separados por comas.
export function readTrustProxy(value = process.env.TRUST_PROXY) {
  const raw = String(value ?? '').trim();
  if (!raw || raw === 'false') return null;
  // Confiar en cualquier proxy permitiría falsificar la IP con X-Forwarded-For.
  if (raw === 'true') throw new Error('TRUST_PROXY=true no es seguro: indica la cantidad de proxies (por ejemplo 1) o sus direcciones.');
  if (/^\d+$/.test(raw)) return Number(raw);
  const parts = raw.split(',').map((part) => part.trim()).filter(Boolean);
  const valid = parts.every((part) => ['loopback', 'linklocal', 'uniquelocal'].includes(part) || /^[0-9a-f.:]+(\/\d{1,3})?$/i.test(part));
  if (!valid) throw new Error(`TRUST_PROXY "${raw}" no es válido.`);
  return parts.join(',');
}

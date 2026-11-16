// Convierte un enlace de YouTube o Vimeo en su dirección para incrustar; otros sitios no se aceptan.
export function toEmbedUrl(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  const host = parsed.hostname.replace(/^www\.|^m\./, '');
  const youtubeId = /^[A-Za-z0-9_-]{11}$/;

  if (host === 'youtu.be') {
    const id = parsed.pathname.slice(1);
    return youtubeId.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const parts = parsed.pathname.split('/').filter(Boolean);
    const id = parsed.pathname === '/watch' ? parsed.searchParams.get('v') : (['embed', 'shorts', 'live'].includes(parts[0]) ? parts[1] : null);
    return id && youtubeId.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = parsed.pathname.split('/').filter(Boolean).pop();
    return /^\d{6,12}$/.test(id || '') ? `https://player.vimeo.com/video/${id}` : null;
  }
  return null;
}

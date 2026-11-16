import { googleRequest } from './googleCloud.js';

// Lectura de Google Drive (API v3) con el alcance drive.readonly; MENTOR nunca modifica Drive.
const DRIVE = 'https://www.googleapis.com/drive/v3';
export const FOLDER_MIME = 'application/vnd.google-apps.folder';
export const GOOGLE_DOC_MIME = 'application/vnd.google-apps.document';

// Datos básicos de la carpeta; sirve para confirmar el acceso.
export async function getFolder(folderId) {
  const query = new URLSearchParams({ fields: 'id,name,mimeType,trashed', supportsAllDrives: 'true' });
  return googleRequest({ url: `${DRIVE}/files/${encodeURIComponent(folderId)}?${query}` });
}

// Una página de archivos de la carpeta (solo hijos directos, sin papelera).
export async function listChildren(folderId, pageToken) {
  const query = new URLSearchParams({
    q: `'${folderId}' in parents and trashed = false`,
    fields: 'nextPageToken,files(id,name,mimeType,modifiedTime,md5Checksum,size)',
    pageSize: '100',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
    ...(pageToken ? { pageToken } : {}),
  });
  return googleRequest({ url: `${DRIVE}/files?${query}` });
}

// Exporta un documento de Google Docs como texto plano.
export async function exportDocText(fileId) {
  return googleRequest({ url: `${DRIVE}/files/${encodeURIComponent(fileId)}/export?mimeType=text%2Fplain`, responseType: 'text' });
}

// Descarga la versión vigente de un archivo binario (PDF, DOCX, TXT).
export async function downloadFile(fileId) {
  return googleRequest({ url: `${DRIVE}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, responseType: 'buffer' });
}

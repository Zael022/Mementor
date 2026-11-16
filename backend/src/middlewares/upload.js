import { randomBytes } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import multer from 'multer';

const backendRoot = fileURLToPath(new URL('../..', import.meta.url));

// Tipos de archivo permitidos: extensión y tipo deben coincidir.
const ALLOWED = {
  '.pdf': ['application/pdf'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.txt': ['text/plain'],
};

// Carpeta privada de archivos; no se sirve como carpeta pública.
export function uploadDir() {
  const dir = path.resolve(backendRoot, process.env.UPLOAD_DIR || 'storage/uploads');
  mkdirSync(dir, { recursive: true });
  return dir;
}

const storage = multer.diskStorage({
  destination: (req, file, done) => done(null, uploadDir()),
  // El nombre guardado es aleatorio para que nadie pueda adivinarlo ni sobrescribir otro archivo.
  filename: (req, file, done) => done(null, `${randomBytes(16).toString('hex')}${path.extname(file.originalname).toLowerCase()}`),
});

// Recibe un solo archivo con límite de tamaño y tipo.
export const receiveFile = multer({
  storage,
  limits: { fileSize: Number(process.env.UPLOAD_MAX_MB || 10) * 1024 * 1024, files: 1 },
  fileFilter: (req, file, done) => {
    const extension = path.extname(file.originalname).toLowerCase();
    done(null, Boolean(ALLOWED[extension]?.includes(file.mimetype)));
  },
}).single('file');

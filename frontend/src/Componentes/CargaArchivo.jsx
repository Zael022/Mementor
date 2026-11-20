import { useId } from 'react';
import { useDropzone } from 'react-dropzone';
import { AnimatePresence, LazyMotion, MotionConfig, domAnimation, m } from 'motion/react';
import { tamanoArchivo } from '../utils/fechas.js';
import Icono from './Iconos.jsx';

// Adaptación del componente File Upload de Aceternity UI (https://ui.aceternity.com/components/file-upload):
// zona con patrón de cuadrícula, react-dropzone y la ficha del archivo animada con Motion.
// Cambios de MENTOR AI: un solo archivo, botón real para teclado, formatos y tamaño del servidor, estilos del proyecto.

export const FORMATOS = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'text/plain': ['.txt'],
};
export const MAXIMO_MB = 10;
const MotionDiv = m.div;
const TRANSICION = { duration: 0.2, ease: [0.22, 1, 0.36, 1] };

// Mensaje claro para un archivo que no cumple las reglas.
function motivoRechazo(rechazo) {
  const codigo = rechazo?.errors?.[0]?.code;
  if (codigo === 'file-too-large') return `El archivo supera ${MAXIMO_MB} MB.`;
  if (codigo === 'file-invalid-type') return 'Formato no permitido. Usa PDF, Word, PowerPoint, Excel, imagen o texto.';
  return 'No se pudo preparar el archivo.';
}

// Patrón de cuadrícula de fondo, como en el componente original.
function Patron() {
  return (
    <div className="carga-patron" aria-hidden="true">
      {Array.from({ length: 11 * 41 }, (_, indice) => <span key={indice} className={indice % 2 === 0 ? 'par' : ''} />)}
    </div>
  );
}

// Zona para soltar o elegir un archivo; muestra nombre y tamaño antes de confirmar.
export default function CargaArchivo({ archivo, alElegir, alRechazar, deshabilitado }) {
  const idAyuda = useId();
  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    multiple: false,
    noClick: true,
    noKeyboard: true,
    accept: FORMATOS,
    maxSize: MAXIMO_MB * 1024 * 1024,
    disabled: deshabilitado,
    onDropAccepted: ([elegido]) => alElegir(elegido),
    onDropRejected: ([rechazo]) => alRechazar(motivoRechazo(rechazo)),
  });

  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">
        <div {...getRootProps({ className: `carga${isDragActive ? ' arrastrando' : ''}${archivo ? ' con-archivo' : ''}` })}>
          <Patron />
          <input {...getInputProps({ 'aria-describedby': idAyuda, 'aria-label': 'Archivo para subir' })} />
          <div className="carga-contenido">
            <p className="carga-titulo">{isDragActive ? 'Suelta el archivo aquí' : 'Arrastra un archivo o elígelo'}</p>
            <p id={idAyuda} className="carga-ayuda">PDF, Word, PowerPoint, Excel, imagen o texto · máximo {MAXIMO_MB} MB. PDF con texto, DOCX y TXT también los consulta el tutor.</p>
            <AnimatePresence mode="wait" initial={false}>
              {archivo ? (
                <MotionDiv key={`${archivo.name}-${archivo.size}`} className="carga-ficha" layout
                  initial={{ opacity: 0, y: 8, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -6 }} transition={TRANSICION}>
                  <strong className="carga-nombre">{archivo.name}</strong>
                  <span className="pildora">{tamanoArchivo(archivo.size)}</span>
                  <span className="tenue pequeno">{archivo.type || 'tipo desconocido'}</span>
                </MotionDiv>
              ) : (
                <MotionDiv key="vacio" className="carga-icono" aria-hidden="true"
                  initial={{ opacity: 0 }} animate={{ opacity: 1, y: isDragActive ? -6 : 0 }} exit={{ opacity: 0 }} transition={TRANSICION}>
                  <Icono nombre="subir" tamano={22} />
                </MotionDiv>
              )}
            </AnimatePresence>
            <button type="button" className="boton secundario" onClick={open} disabled={deshabilitado}>
              {archivo ? 'Cambiar archivo' : 'Elegir archivo'}
            </button>
          </div>
        </div>
      </MotionConfig>
    </LazyMotion>
  );
}

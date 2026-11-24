#!/bin/bash
# Genera el ZIP de entrega solo con los archivos versionados (lista de inclusión de git):
# sin node_modules, .env, archivos subidos, capturas de prueba ni compilados.
# Uso: scripts/empaquetar.sh [salida.zip]
set -euo pipefail
cd "$(dirname "$0")/.."
if [ -n "$(git status --porcelain)" ]; then
  echo "Hay cambios sin confirmar: haz commit antes de empaquetar para que el ZIP corresponda a un commit." >&2
  exit 1
fi
commit=$(git rev-parse --short HEAD)
salida="${1:-../MENTOR_AI_${commit}.zip}"
git archive --format=zip --prefix=mementor/ -o "$salida" HEAD
echo "ZIP: $salida"
echo "Commit: $(git rev-parse HEAD)"
echo "Fecha: $(date -Iseconds)"
echo "Archivos: $(unzip -Z1 "$salida" | grep -vc '/$')"

import { Institution, User, sequelize } from '../models/index.js';
import { conflict, notFound } from '../utils/AppError.js';
import { pageMeta } from '../utils/http.js';
import { recordAudit } from './auditService.js';

const toDto = (institution) => ({
  id: institution.id,
  name: institution.name,
  slug: institution.slug,
  status: institution.status,
  maxDocuments: institution.maxDocuments,
  aiDailyQuestionLimit: institution.aiDailyQuestionLimit,
  createdAt: institution.createdAt,
});

// Convierte el nombre en un identificador para URL.
function slugify(text) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
}

// Lista las instituciones registradas.
export async function listInstitutions(pagination) {
  const { rows, count } = await Institution.findAndCountAll({ order: [['name', 'ASC']], limit: pagination.limit, offset: pagination.offset });
  return { data: rows.map(toDto), meta: pageMeta(pagination, count) };
}

// Crea una institución nueva.
export async function createInstitution(actor, { name, slug }) {
  const finalSlug = slugify(slug || name);
  if (!finalSlug) throw conflict('INVALID_SLUG', 'El nombre no genera un identificador válido.');
  if (await Institution.findOne({ where: { slug: finalSlug } })) {
    throw conflict('SLUG_IN_USE', 'Ya existe una institución con ese identificador.');
  }
  return sequelize.transaction(async (transaction) => {
    const institution = await Institution.create({ name, slug: finalSlug }, { transaction });
    await recordAudit({ actor, institutionId: null, action: 'institution.created', resourceType: 'institution', resourceId: institution.id, transaction });
    return toDto(institution);
  });
}

// Lista los administradores de una institución.
export async function listInstitutionAdmins(institutionId) {
  if (!(await Institution.findByPk(institutionId))) throw notFound('Institución no encontrada.');
  const admins = await User.findAll({ where: { institutionId, role: 'institution_admin' }, order: [['displayName', 'ASC']] });
  return admins.map((user) => ({ id: user.id, email: user.email, displayName: user.displayName, status: user.status }));
}

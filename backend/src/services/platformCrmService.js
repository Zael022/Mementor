import { Op } from 'sequelize';
import { Institution, PlatformCrmAccount, PlatformCrmContact, sequelize } from '../models/index.js';
import { conflict, notFound } from '../utils/AppError.js';
import { pageMeta, readPagination } from '../utils/http.js';
import { recordAudit } from './auditService.js';

const audit = (actor, action, id, institutionId, transaction) => recordAudit({
  actor: { id: actor.id, institutionId: null }, action, resourceType: 'platform_crm', resourceId: id,
  metadata: { targetInstitutionId: institutionId }, transaction,
});

export async function listInstitutions(query) {
  const pagination = readPagination(query);
  const where = query.search ? { name: { [Op.like]: `%${query.search}%` } } : {};
  const { rows, count } = await Institution.findAndCountAll({ where, include: [{ model: PlatformCrmAccount, as: 'platformCrmAccount' }], order: [['name', 'ASC'], ['id', 'ASC']], limit: pagination.limit, offset: pagination.offset });
  return { data: rows.map((row) => ({ id: row.id, name: row.name, status: row.status, account: row.platformCrmAccount })), meta: pageMeta(pagination, count) };
}

export async function detail(id) {
  const institution = await Institution.findByPk(id, { include: [{ model: PlatformCrmAccount, as: 'platformCrmAccount' }] });
  if (!institution) throw notFound('Institución no encontrada.');
  return { id: institution.id, name: institution.name, status: institution.status, maxDocuments: institution.maxDocuments, aiDailyQuestionLimit: institution.aiDailyQuestionLimit, account: institution.platformCrmAccount };
}

export async function initialize(actor, institutionId) {
  return sequelize.transaction(async (transaction) => {
    const institution = await Institution.findByPk(institutionId, { transaction, lock: transaction.LOCK.UPDATE });
    if (!institution) throw notFound('Institución no encontrada.');
    let account = await PlatformCrmAccount.findOne({ where: { institutionId }, transaction });
    if (!account) {
      account = await PlatformCrmAccount.create({ institutionId, responsibleId: actor.id }, { transaction });
      await audit(actor, 'platform_crm.account_created', account.id, institution.id, transaction);
    }
    return account;
  });
}

export async function updateAccount(actor, institutionId, input) {
  return sequelize.transaction(async (transaction) => {
    const account = await PlatformCrmAccount.findOne({ where: { institutionId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!account) throw notFound('Seguimiento no configurado.');
    if (account.version !== input.version) throw conflict('VERSION_CONFLICT', 'La ficha cambió. Actualízala antes de guardar.');
    const { version, ...changes } = input;
    await account.update({ ...changes, version: version + 1 }, { transaction });
    await audit(actor, 'platform_crm.account_updated', account.id, account.institutionId, transaction);
    return account;
  });
}

async function accountFor(institutionId, transaction) {
  const account = await PlatformCrmAccount.findOne({ where: { institutionId }, transaction });
  if (!account) throw notFound('Seguimiento no configurado.');
  return account;
}

export async function listContacts(institutionId, query) {
  const account = await accountFor(institutionId);
  const pagination = readPagination(query);
  const { rows, count } = await PlatformCrmContact.findAndCountAll({ where: { accountId: account.id }, order: [['id', 'DESC']], limit: pagination.limit, offset: pagination.offset });
  return { data: rows, meta: pageMeta(pagination, count) };
}

export async function addContact(actor, institutionId, input) {
  return sequelize.transaction(async (transaction) => {
    const account = await PlatformCrmAccount.findOne({ where: { institutionId }, transaction, lock: transaction.LOCK.UPDATE });
    if (!account) throw notFound('Seguimiento no configurado.');
    const existing = await PlatformCrmContact.findOne({ where: { accountId: account.id, requestKey: input.requestKey }, transaction });
    if (existing) {
      for (const field of ['name', 'position', 'email', 'phone']) {
        if ((existing[field] || '') !== (input[field] || '')) throw conflict('REQUEST_CONFLICT', 'La solicitud ya se utilizó con otros datos.');
      }
      return existing;
    }
    const contact = await PlatformCrmContact.create({ ...input, accountId: account.id, actorId: actor.id }, { transaction });
    await audit(actor, 'platform_crm.contact_created', contact.id, account.institutionId, transaction);
    return contact;
  });
}

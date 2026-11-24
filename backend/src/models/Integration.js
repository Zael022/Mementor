import { DataTypes } from 'sequelize';
import { sequelize } from '../config/database.js';

// Tipo de cambio de referencia del dólar (compra y venta) por día y fuente.
export const ExchangeRate = sequelize.define('ExchangeRate', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  rateDate: { type: DataTypes.DATEONLY, allowNull: false },
  source: { type: DataTypes.STRING(30), allowNull: false },
  buy: { type: DataTypes.DECIMAL(10, 4), allowNull: false },
  sell: { type: DataTypes.DECIMAL(10, 4), allowNull: false },
}, { tableName: 'exchange_rates', underscored: true });

// Llamada a una API externa o recibida desde n8n (sin datos personales).
export const IntegrationRun = sequelize.define('IntegrationRun', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  integration: { type: DataTypes.STRING(40), allowNull: false },
  direction: { type: DataTypes.ENUM('outbound', 'inbound'), allowNull: false },
  status: { type: DataTypes.ENUM('ok', 'error'), allowNull: false },
  detail: { type: DataTypes.STRING(255), allowNull: true },
  latencyMs: { type: DataTypes.INTEGER, allowNull: true },
}, { tableName: 'integration_runs', underscored: true });

// Recordatorio diario enviado (o fallido) por persona y día: un reintento no repite lo que ya salió.
export const ReminderDelivery = sequelize.define('ReminderDelivery', {
  id: { type: DataTypes.BIGINT.UNSIGNED, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.BIGINT.UNSIGNED, allowNull: false },
  reminderDay: { type: DataTypes.DATEONLY, allowNull: false },
  status: { type: DataTypes.ENUM('sent', 'failed'), allowNull: false },
  attempts: { type: DataTypes.INTEGER.UNSIGNED, allowNull: false, defaultValue: 1 },
}, { tableName: 'reminder_deliveries', underscored: true });

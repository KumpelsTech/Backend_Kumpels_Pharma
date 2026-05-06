import { Sequelize, Op, fn, where, col } from 'sequelize';

const database = process.env.RDS_DB_NAME;
const username = process.env.RDS_USERNAME;
const password = process.env.RDS_PASSWORD;
const host = process.env.RDS_HOSTNAME;
const port = process.env.RDS_PORT ? parseInt(process.env.RDS_PORT) : undefined;

if (!database || !username || !password || !host || port === undefined) {
  throw new Error('One or more required environment variables are missing or invalid.');
}

const sequelize = new Sequelize(database, username, password, {
  host: host,
  port: port,
  dialect: 'postgres',
dialectOptions: {
    ssl: (host === 'localhost' || host === '127.0.0.1') 
      ? false 
      : {
          require: true,
          rejectUnauthorized: false
        }
  },
  timezone: '-05:00',
  logging: false,
  define: {
    timestamps: true,
    underscored: true,
  },
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
});

export { Op, fn, where, col };
export default sequelize;

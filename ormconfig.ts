import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config({ path: `./env/${process.env.NODE_ENV}.env` });

const dataSource = new DataSource({
  type: process.env.DB_TYPE as PostgresConnectionOptions['type'],
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  entities: ['src/**/*.entity.{js,ts}'],
  migrations: ['src/migrations/*.{js,ts}'],
});

export default dataSource;

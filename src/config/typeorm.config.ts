import { ConfigModule, ConfigService } from '@nestjs/config';
import {
  TypeOrmModuleAsyncOptions,
  TypeOrmModuleOptions,
} from '@nestjs/typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';

export default class TypeOrmConfig {
  static getOrmConfig(configService: ConfigService): TypeOrmModuleOptions {
    return {
      type: String(
        configService.get('DB_TYPE'),
      ) as PostgresConnectionOptions['type'],
      host: String(configService.get('DB_HOST')),
      port: Number(configService.get('DB_PORT')),
      username: String(configService.get('DB_USER')),
      password: String(configService.get('DB_PASSWORD')),
      database: String(configService.get('DB_NAME')),
      autoLoadEntities:
        configService.get('TYPEORM_AUTO_LOAD_ENTITIES') === 'true'
          ? true
          : false,
      synchronize:
        configService.get('TYPEORM_SYNCHRONIZE') === 'true' ? true : false,
    };
  }
}

export const typeOrmConfigAsync: TypeOrmModuleAsyncOptions = {
  imports: [ConfigModule],
  useFactory: async (
    configService: ConfigService,
  ): Promise<TypeOrmModuleOptions> => TypeOrmConfig.getOrmConfig(configService),
  inject: [ConfigService],
};

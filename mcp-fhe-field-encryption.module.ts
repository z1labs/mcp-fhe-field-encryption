import { Module } from '@nestjs/common';
import { McpFheFieldEncryptionService } from './mcp-fhe-field-encryption.service';
import { EvmUtils } from 'modules/blockchain/evm.utils';
import { KmsModule } from 'modules/kms/kms.module';
import { DatabaseModule } from 'modules/database/database.module';
import { SettingsModule } from 'modules/settings/settings.module';

@Module({
    imports: [
        KmsModule,
        DatabaseModule,
        SettingsModule
    ],
    providers: [
        McpFheFieldEncryptionService,
        EvmUtils
    ],
    exports: [McpFheFieldEncryptionService]
})
export class McpFheFieldEncryptionModule {}
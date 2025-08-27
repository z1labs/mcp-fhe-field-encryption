import { IsString, IsEnum, IsOptional, IsBoolean, IsNumber, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { FheScheme, SecurityLevel } from '../types';

export class EncryptFieldDto {
    @ApiProperty({ description: 'Name of the field to encrypt' })
    @IsString()
    fieldName: string;

    @ApiProperty({ description: 'Value to encrypt' })
    value: any;

    @ApiProperty({ description: 'Data type of the value' })
    @IsString()
    dataType: string;

    @ApiProperty({ enum: FheScheme, description: 'FHE scheme to use' })
    @IsEnum(FheScheme)
    scheme: FheScheme;

    @ApiPropertyOptional({ enum: SecurityLevel, description: 'Security level' })
    @IsOptional()
    @IsEnum(SecurityLevel)
    securityLevel?: SecurityLevel;

    @ApiPropertyOptional({ description: 'Allow bootstrapping for noise refresh' })
    @IsOptional()
    @IsBoolean()
    allowBootstrapping?: boolean;

    @ApiPropertyOptional({ description: 'Store encrypted data on blockchain' })
    @IsOptional()
    @IsBoolean()
    storeOnChain?: boolean;
}

export class DecryptFieldDto {
    @ApiProperty({ description: 'Name of the field to decrypt' })
    @IsString()
    fieldName: string;

    @ApiProperty({ description: 'Encrypted value' })
    @IsString()
    encryptedValue: string;

    @ApiProperty({ description: 'Ciphertext metadata' })
    @IsObject()
    metadata: {
        scheme: FheScheme;
        securityLevel: SecurityLevel;
        noiseLevel: number;
        bootstrappable: boolean;
        timestamp: number;
        version: string;
    };

    @ApiProperty({ description: 'Original data type' })
    @IsString()
    originalDataType: string;
}

export class HomomorphicOperationDto {
    @ApiProperty({ 
        enum: ['add', 'multiply', 'subtract', 'negate', 'rotate', 'bootstrap'],
        description: 'Type of homomorphic operation' 
    })
    @IsString()
    type: 'add' | 'multiply' | 'subtract' | 'negate' | 'rotate' | 'bootstrap';

    @ApiProperty({ type: [String], description: 'Encrypted inputs' })
    @IsString({ each: true })
    inputs: string[];

    @ApiProperty({ enum: FheScheme, description: 'FHE scheme' })
    @IsEnum(FheScheme)
    scheme: FheScheme;

    @ApiPropertyOptional({ description: 'Automatically bootstrap if noise exceeds threshold' })
    @IsOptional()
    @IsBoolean()
    autoBootstrap?: boolean;

    @ApiPropertyOptional({ description: 'Rotation amount for rotate operation' })
    @IsOptional()
    @IsNumber()
    rotationAmount?: number;
}

export class BatchEncryptionDto {
    @ApiProperty({ type: [EncryptFieldDto], description: 'Fields to encrypt' })
    @ValidateNested({ each: true })
    @Type(() => EncryptFieldDto)
    fields: EncryptFieldDto[];

    @ApiProperty({ enum: FheScheme, description: 'Common scheme for all fields' })
    @IsEnum(FheScheme)
    commonScheme: FheScheme;

    @ApiPropertyOptional({ description: 'Use packed encryption for efficiency' })
    @IsOptional()
    @IsBoolean()
    packedEncryption?: boolean;

    @ApiPropertyOptional({ description: 'Enable compression' })
    @IsOptional()
    @IsBoolean()
    compressionEnabled?: boolean;
}

export class BatchDecryptionDto {
    @ApiProperty({ type: [DecryptFieldDto], description: 'Fields to decrypt' })
    @ValidateNested({ each: true })
    @Type(() => DecryptFieldDto)
    fields: DecryptFieldDto[];

    @ApiPropertyOptional({ description: 'Process in parallel' })
    @IsOptional()
    @IsBoolean()
    parallelProcessing?: boolean;

    @ApiPropertyOptional({ 
        enum: ['skip', 'fail'],
        description: 'Error handling strategy' 
    })
    @IsOptional()
    @IsString()
    errorHandling?: 'skip' | 'fail';
}

export class CreateCircuitDto {
    @ApiProperty({ description: 'Circuit name' })
    @IsString()
    name: string;

    @ApiProperty({ type: [String], description: 'Input wire names' })
    @IsString({ each: true })
    inputs: string[];

    @ApiProperty({ type: [String], description: 'Output wire names' })
    @IsString({ each: true })
    outputs: string[];

    @ApiProperty({ description: 'Circuit gates', type: 'array', items: { type: 'object' } })
    gates: Array<{
        operation: string;
        inputs: string[];
        output: string;
        parameters?: any;
    }>;
}

export class ExecuteCircuitDto {
    @ApiProperty({ description: 'Circuit ID' })
    @IsString()
    circuitId: string;

    @ApiProperty({ description: 'Encrypted inputs', type: 'object' })
    @IsObject()
    encryptedInputs: Record<string, string>;
}

export class KeyGenerationDto {
    @ApiProperty({ enum: FheScheme, description: 'FHE scheme' })
    @IsEnum(FheScheme)
    scheme: FheScheme;

    @ApiPropertyOptional({ enum: SecurityLevel, description: 'Security level' })
    @IsOptional()
    @IsEnum(SecurityLevel)
    securityLevel?: SecurityLevel;

    @ApiPropertyOptional({ description: 'Generate bootstrapping keys' })
    @IsOptional()
    @IsBoolean()
    generateBootstrappingKeys?: boolean;

    @ApiPropertyOptional({ description: 'Generate Galois keys for rotations' })
    @IsOptional()
    @IsBoolean()
    generateGaloisKeys?: boolean;
}

export class NoiseEstimateDto {
    @ApiProperty({ description: 'Encrypted value to estimate noise for' })
    @IsString()
    encryptedValue: string;

    @ApiProperty({ enum: FheScheme, description: 'FHE scheme' })
    @IsEnum(FheScheme)
    scheme: FheScheme;
}

export class ReencryptionDto {
    @ApiProperty({ description: 'Encrypted value to re-encrypt' })
    @IsString()
    encryptedValue: string;

    @ApiProperty({ description: 'New public key hash' })
    @IsString()
    newPublicKeyHash: string;

    @ApiProperty({ enum: FheScheme, description: 'FHE scheme' })
    @IsEnum(FheScheme)
    scheme: FheScheme;
}
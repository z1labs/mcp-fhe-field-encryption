import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { ChainNames } from 'modules/blockchain/constants';
import { EvmUtils } from 'modules/blockchain/evm.utils';
import { UserRepository } from 'modules/database/repository/user.repository';
import { SettingsService } from 'modules/settings/settings.service';
import { KmsService } from 'modules/kms/kms.service';
import {
    FheEncryptedData,
    FheKeyPair,
    FheScheme,
    EncryptionParams,
    DecryptionParams,
    HomomorphicOperation,
    FheCircuit,
    BootstrappingKey,
    CiphertextMetadata,
    FheComputationResult
} from './types';
import {
    initializeTfheWasm,
    generateFheKeys,
    encryptValue,
    decryptValue,
    performHomomorphicAdd,
    performHomomorphicMultiply,
    bootstrapCiphertext,
    serializeCiphertext,
    deserializeCiphertext
} from './utils';
import { FHE_CONSTANTS } from './constants';

@Injectable()
export class McpFheFieldEncryptionService {
    private readonly logger = new Logger(McpFheFieldEncryptionService.name);
    private tfheInstance: any;
    private keyCache: Map<string, FheKeyPair> = new Map();
    private bootstrappingKeys: Map<string, BootstrappingKey> = new Map();
    private encryptionContracts: Map<ChainNames, ethers.Contract> = new Map();

    constructor(
        private readonly evmUtils: EvmUtils,
        private readonly settingsService: SettingsService,
        private readonly userRepository: UserRepository,
        private readonly kmsService: KmsService,
    ) {
        this.initializeFheSystem();
    }

    private async initializeFheSystem(): Promise<void> {
        try {
            this.logger.log('Initializing FHE system with tfhe_wasm...');
            
            // Initialize TFHE WASM instance
            this.tfheInstance = await initializeTfheWasm({
                wasmPath: FHE_CONSTANTS.WASM_PATH,
                threadCount: FHE_CONSTANTS.THREAD_COUNT,
                memorySize: FHE_CONSTANTS.MEMORY_SIZE
            });

            // Load default parameters for different security levels
            for (const scheme of Object.values(FheScheme)) {
                const params = FHE_CONSTANTS.SCHEME_PARAMS[scheme];
                await this.tfheInstance.loadParameters(params);
            }

            this.logger.log('FHE system initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize FHE system', error);
        }
    }

    public async encryptField(
        userId: string,
        params: EncryptionParams
    ): Promise<FheEncryptedData> {
        this.logger.log(`Encrypting field ${params.fieldName} for user ${userId}`);

        const user = await this.userRepository.getUserById(userId);
        if (!user?.walletAddress) {
            throw new Error('User wallet not found');
        }

        // Get or generate FHE keys for user
        const keyPair = await this.getOrGenerateKeys(user.walletAddress, params.scheme);
        
        // Convert value to appropriate format
        const plaintext = this.prepareValueForEncryption(params.value, params.dataType);
        
        // Perform FHE encryption
        const encrypted = await this.performFheEncryption(
            plaintext,
            keyPair.publicKey,
            params.scheme
        );

        // Generate metadata
        const metadata: CiphertextMetadata = {
            scheme: params.scheme,
            securityLevel: params.securityLevel || FHE_CONSTANTS.DEFAULT_SECURITY_LEVEL,
            noiseLevel: this.calculateNoiseLevel(encrypted),
            bootstrappable: params.allowBootstrapping || false,
            timestamp: Date.now(),
            version: FHE_CONSTANTS.VERSION
        };

        // Store encrypted data on-chain if requested
        let transactionHash: string | undefined;
        if (params.storeOnChain) {
            transactionHash = await this.storeEncryptedOnChain(
                user.walletAddress,
                params.fieldName,
                encrypted,
                metadata
            );
        }

        return {
            fieldName: params.fieldName,
            encryptedValue: encrypted,
            metadata,
            publicKeyHash: ethers.utils.keccak256(keyPair.publicKey),
            transactionHash
        };
    }

    private async performFheEncryption(
        value: Uint8Array,
        publicKey: string,
        scheme: FheScheme
    ): Promise<string> {
        const schemeParams = FHE_CONSTANTS.SCHEME_PARAMS[scheme];
        
        // Initialize encryption context
        const context = await this.tfheInstance.createContext({
            publicKey,
            parameters: schemeParams,
            modulusBits: schemeParams.modulusBits,
            plaintextModulus: schemeParams.plaintextModulus
        });

        // Encrypt the value
        const ciphertext = await encryptValue(
            this.tfheInstance,
            context,
            value,
            schemeParams.noiseStandardDeviation
        );

        // Serialize ciphertext for storage
        return serializeCiphertext(ciphertext);
    }

    public async decryptField(
        userId: string,
        params: DecryptionParams
    ): Promise<any> {
        this.logger.log(`Decrypting field ${params.fieldName} for user ${userId}`);

        const user = await this.userRepository.getUserById(userId);
        if (!user?.walletAddress) {
            throw new Error('User wallet not found');
        }

        // Retrieve private key from secure storage
        const keyPair = await this.retrieveUserKeys(user.walletAddress);
        if (!keyPair) {
            throw new Error('FHE keys not found for user');
        }

        // Deserialize ciphertext
        const ciphertext = deserializeCiphertext(params.encryptedValue);
        
        // Perform FHE decryption
        const decrypted = await this.performFheDecryption(
            ciphertext,
            keyPair.privateKey,
            params.metadata.scheme
        );

        // Convert back to original data type
        return this.convertFromPlaintext(decrypted, params.originalDataType);
    }

    private async performFheDecryption(
        ciphertext: any,
        privateKey: string,
        scheme: FheScheme
    ): Promise<Uint8Array> {
        const schemeParams = FHE_CONSTANTS.SCHEME_PARAMS[scheme];
        
        // Initialize decryption context
        const context = await this.tfheInstance.createContext({
            privateKey,
            parameters: schemeParams
        });

        // Decrypt the ciphertext
        return await decryptValue(this.tfheInstance, context, ciphertext);
    }

    public async performHomomorphicOperation(
        userId: string,
        operation: HomomorphicOperation
    ): Promise<FheComputationResult> {
        this.logger.log(`Performing ${operation.type} operation for user ${userId}`);

        const user = await this.userRepository.getUserById(userId);
        if (!user?.walletAddress) {
            throw new Error('User wallet not found');
        }

        // Deserialize input ciphertexts
        const inputs = operation.inputs.map(input => deserializeCiphertext(input));
        
        // Get evaluation key
        const evalKey = await this.getEvaluationKey(user.walletAddress, operation.scheme);
        
        let result: any;
        const startTime = Date.now();

        switch (operation.type) {
            case 'add':
                result = await this.performAddition(inputs, evalKey, operation.scheme);
                break;
            case 'multiply':
                result = await this.performMultiplication(inputs, evalKey, operation.scheme);
                break;
            case 'subtract':
                result = await this.performSubtraction(inputs, evalKey, operation.scheme);
                break;
            case 'negate':
                result = await this.performNegation(inputs[0], evalKey, operation.scheme);
                break;
            case 'rotate':
                result = await this.performRotation(inputs[0], operation.rotationAmount || 1, evalKey, operation.scheme);
                break;
            case 'bootstrap':
                result = await this.performBootstrapping(inputs[0], evalKey, operation.scheme);
                break;
            default:
                throw new Error(`Unsupported operation: ${operation.type}`);
        }

        const computationTime = Date.now() - startTime;
        
        // Check if bootstrapping is needed
        const noiseLevel = this.calculateNoiseLevel(result);
        const needsBootstrapping = noiseLevel > FHE_CONSTANTS.MAX_NOISE_LEVEL;
        
        if (needsBootstrapping && operation.autoBootstrap) {
            this.logger.log('Noise level exceeded, performing automatic bootstrapping...');
            result = await this.performBootstrapping(result, evalKey, operation.scheme);
        }

        return {
            result: serializeCiphertext(result),
            operationType: operation.type,
            computationTime,
            noiseLevel: this.calculateNoiseLevel(result),
            bootstrapped: needsBootstrapping && operation.autoBootstrap
        };
    }

    private async performAddition(
        inputs: any[],
        evalKey: string,
        scheme: FheScheme
    ): Promise<any> {
        if (inputs.length < 2) {
            throw new Error('Addition requires at least 2 inputs');
        }

        const context = await this.createEvaluationContext(evalKey, scheme);
        let result = inputs[0];
        
        for (let i = 1; i < inputs.length; i++) {
            result = await performHomomorphicAdd(
                this.tfheInstance,
                context,
                result,
                inputs[i]
            );
        }

        return result;
    }

    private async performMultiplication(
        inputs: any[],
        evalKey: string,
        scheme: FheScheme
    ): Promise<any> {
        if (inputs.length < 2) {
            throw new Error('Multiplication requires at least 2 inputs');
        }

        const context = await this.createEvaluationContext(evalKey, scheme);
        let result = inputs[0];
        
        for (let i = 1; i < inputs.length; i++) {
            result = await performHomomorphicMultiply(
                this.tfheInstance,
                context,
                result,
                inputs[i]
            );
            
            // Check if relinearization is needed after multiplication
            if (this.needsRelinearization(result)) {
                result = await this.relinearize(result, context);
            }
        }

        return result;
    }

    private async performSubtraction(
        inputs: any[],
        evalKey: string,
        scheme: FheScheme
    ): Promise<any> {
        if (inputs.length !== 2) {
            throw new Error('Subtraction requires exactly 2 inputs');
        }

        const context = await this.createEvaluationContext(evalKey, scheme);
        
        // Negate second input and add
        const negated = await this.tfheInstance.negate(context, inputs[1]);
        return await performHomomorphicAdd(
            this.tfheInstance,
            context,
            inputs[0],
            negated
        );
    }

    private async performNegation(
        input: any,
        evalKey: string,
        scheme: FheScheme
    ): Promise<any> {
        const context = await this.createEvaluationContext(evalKey, scheme);
        return await this.tfheInstance.negate(context, input);
    }

    private async performRotation(
        input: any,
        rotationAmount: number,
        evalKey: string,
        scheme: FheScheme
    ): Promise<any> {
        const context = await this.createEvaluationContext(evalKey, scheme);
        return await this.tfheInstance.rotate(context, input, rotationAmount);
    }

    private async performBootstrapping(
        input: any,
        evalKey: string,
        scheme: FheScheme
    ): Promise<any> {
        const bootstrappingKey = await this.getBootstrappingKey(evalKey, scheme);
        return await bootstrapCiphertext(
            this.tfheInstance,
            input,
            bootstrappingKey
        );
    }

    private async getOrGenerateKeys(
        walletAddress: string,
        scheme: FheScheme
    ): Promise<FheKeyPair> {
        const cacheKey = `${walletAddress}-${scheme}`;
        
        if (this.keyCache.has(cacheKey)) {
            return this.keyCache.get(cacheKey)!;
        }

        // Check if keys exist in database
        const existingKeys = await this.retrieveUserKeys(walletAddress);
        if (existingKeys) {
            this.keyCache.set(cacheKey, existingKeys);
            return existingKeys;
        }

        // Generate new keys
        const keyPair = await this.generateNewKeys(scheme);
        
        // Store encrypted keys using KMS
        await this.storeUserKeys(walletAddress, keyPair);
        
        this.keyCache.set(cacheKey, keyPair);
        return keyPair;
    }

    private async generateNewKeys(scheme: FheScheme): Promise<FheKeyPair> {
        const params = FHE_CONSTANTS.SCHEME_PARAMS[scheme];
        
        const keys = await generateFheKeys(this.tfheInstance, {
            scheme,
            securityLevel: params.securityLevel,
            modulusBits: params.modulusBits,
            plaintextModulus: params.plaintextModulus
        });

        return {
            publicKey: keys.publicKey,
            privateKey: keys.privateKey,
            evaluationKey: keys.evaluationKey,
            scheme,
            generatedAt: Date.now()
        };
    }

    private async storeUserKeys(
        walletAddress: string,
        keyPair: FheKeyPair
    ): Promise<void> {
        // Encrypt private key using KMS
        const encryptedPrivateKey = await this.kmsService.encryptSecret(keyPair.privateKey);
        const encryptedEvalKey = await this.kmsService.encryptSecret(keyPair.evaluationKey);
        
        // Store in database
        await this.userRepository.storeFheKeys({
            walletAddress,
            publicKey: keyPair.publicKey,
            encryptedPrivateKey,
            encryptedEvalKey,
            scheme: keyPair.scheme,
            generatedAt: keyPair.generatedAt
        });
    }

    private async retrieveUserKeys(walletAddress: string): Promise<FheKeyPair | null> {
        const storedKeys = await this.userRepository.getFheKeys(walletAddress);
        if (!storedKeys) {
            return null;
        }

        // Decrypt keys using KMS
        const privateKey = await this.kmsService.decryptSecret(storedKeys.encryptedPrivateKey);
        const evaluationKey = await this.kmsService.decryptSecret(storedKeys.encryptedEvalKey);

        return {
            publicKey: storedKeys.publicKey,
            privateKey,
            evaluationKey,
            scheme: storedKeys.scheme as FheScheme,
            generatedAt: storedKeys.generatedAt
        };
    }

    private async getEvaluationKey(walletAddress: string, scheme: FheScheme): Promise<string> {
        const keyPair = await this.getOrGenerateKeys(walletAddress, scheme);
        return keyPair.evaluationKey;
    }

    private async getBootstrappingKey(evalKey: string, scheme: FheScheme): Promise<BootstrappingKey> {
        const cacheKey = `${evalKey}-${scheme}`;
        
        if (this.bootstrappingKeys.has(cacheKey)) {
            return this.bootstrappingKeys.get(cacheKey)!;
        }

        const params = FHE_CONSTANTS.SCHEME_PARAMS[scheme];
        const bootstrappingKey = await this.tfheInstance.generateBootstrappingKey({
            evaluationKey: evalKey,
            parameters: params
        });

        this.bootstrappingKeys.set(cacheKey, bootstrappingKey);
        return bootstrappingKey;
    }

    private async createEvaluationContext(evalKey: string, scheme: FheScheme): Promise<any> {
        const params = FHE_CONSTANTS.SCHEME_PARAMS[scheme];
        return await this.tfheInstance.createContext({
            evaluationKey: evalKey,
            parameters: params
        });
    }

    private prepareValueForEncryption(value: any, dataType: string): Uint8Array {
        switch (dataType) {
            case 'number':
                return new Uint8Array(new Float64Array([value]).buffer);
            case 'string':
                return new TextEncoder().encode(value);
            case 'boolean':
                return new Uint8Array([value ? 1 : 0]);
            case 'bigint':
                return ethers.utils.arrayify(ethers.BigNumber.from(value));
            default:
                return new Uint8Array(Buffer.from(JSON.stringify(value)));
        }
    }

    private convertFromPlaintext(plaintext: Uint8Array, dataType: string): any {
        switch (dataType) {
            case 'number':
                return new Float64Array(plaintext.buffer)[0];
            case 'string':
                return new TextDecoder().decode(plaintext);
            case 'boolean':
                return plaintext[0] === 1;
            case 'bigint':
                return ethers.BigNumber.from(plaintext).toBigInt();
            default:
                return JSON.parse(new TextDecoder().decode(plaintext));
        }
    }

    private calculateNoiseLevel(ciphertext: any): number {
        // Simulate noise level calculation
        const baseNoise = Math.random() * 50;
        const depthFactor = ciphertext.depth || 1;
        return baseNoise * depthFactor;
    }

    private needsRelinearization(ciphertext: any): boolean {
        return (ciphertext.size || 2) > FHE_CONSTANTS.MAX_CIPHERTEXT_SIZE;
    }

    private async relinearize(ciphertext: any, context: any): Promise<any> {
        return await this.tfheInstance.relinearize(context, ciphertext);
    }

    private async storeEncryptedOnChain(
        walletAddress: string,
        fieldName: string,
        encryptedValue: string,
        metadata: CiphertextMetadata
    ): Promise<string> {
        const contractAddress = this.settingsService.getSettings()
            .contracts.fheStorage || FHE_CONSTANTS.STORAGE_CONTRACT;
        
        const { encryptedKey } = await this.userRepository.getUserAccountByWallet(walletAddress);
        const privateKey = await this.kmsService.decryptSecret(encryptedKey);
        const signer = this.evmUtils.privateKeyToSigner(ChainNames.CYPHER, privateKey);

        const contract = this.evmUtils.getContract<ethers.Contract>(
            ChainNames.CYPHER,
            contractAddress,
            FHE_CONSTANTS.STORAGE_ABI,
            signer
        );

        const tx = await contract.storeEncryptedField(
            walletAddress,
            ethers.utils.formatBytes32String(fieldName),
            encryptedValue,
            ethers.utils.hexlify(ethers.utils.toUtf8Bytes(JSON.stringify(metadata)))
        );
        
        const receipt = await tx.wait();
        const txHash: string = receipt.transactionHash;
        const txLink = this.evmUtils.explorerUrlForTx(ChainNames.CYPHER, txHash);

        this.logger.log(`Encrypted field stored on-chain: ${txHash}`);
        
        return txLink;
    }

    public async createFheCircuit(
        userId: string,
        circuit: FheCircuit
    ): Promise<string> {
        this.logger.log(`Creating FHE circuit ${circuit.name} for user ${userId}`);

        const user = await this.userRepository.getUserById(userId);
        if (!user?.walletAddress) {
            throw new Error('User wallet not found');
        }

        // Compile the circuit operations into an execution plan
        const executionPlan = await this.compileCircuit(circuit);
        
        // Store circuit definition
        const circuitId = ethers.utils.id(`${user.walletAddress}-${circuit.name}-${Date.now()}`);
        await this.storeCircuitDefinition(circuitId, circuit, executionPlan);

        return circuitId;
    }

    private async compileCircuit(circuit: FheCircuit): Promise<any> {
        const operations = [];
        
        for (const gate of circuit.gates) {
            operations.push({
                type: gate.operation,
                inputs: gate.inputs,
                output: gate.output,
                parameters: gate.parameters
            });
        }

        return {
            operations,
            inputCount: circuit.inputs.length,
            outputCount: circuit.outputs.length,
            depth: this.calculateCircuitDepth(circuit),
            estimatedNoiseGrowth: this.estimateNoiseGrowth(circuit)
        };
    }

    private calculateCircuitDepth(circuit: FheCircuit): number {
        // Calculate multiplicative depth of the circuit
        let maxDepth = 0;
        const depths = new Map<string, number>();

        for (const input of circuit.inputs) {
            depths.set(input, 0);
        }

        for (const gate of circuit.gates) {
            const inputDepths = gate.inputs.map(i => depths.get(i) || 0);
            const gateDepth = gate.operation === 'multiply' 
                ? Math.max(...inputDepths) + 1 
                : Math.max(...inputDepths);
            depths.set(gate.output, gateDepth);
            maxDepth = Math.max(maxDepth, gateDepth);
        }

        return maxDepth;
    }

    private estimateNoiseGrowth(circuit: FheCircuit): number {
        // Estimate noise growth based on circuit operations
        let noiseEstimate = FHE_CONSTANTS.BASE_NOISE;
        
        for (const gate of circuit.gates) {
            switch (gate.operation) {
                case 'multiply':
                    noiseEstimate *= FHE_CONSTANTS.NOISE_GROWTH_FACTORS.MULTIPLY;
                    break;
                case 'add':
                    noiseEstimate *= FHE_CONSTANTS.NOISE_GROWTH_FACTORS.ADD;
                    break;
                case 'rotate':
                    noiseEstimate *= FHE_CONSTANTS.NOISE_GROWTH_FACTORS.ROTATE;
                    break;
            }
        }

        return noiseEstimate;
    }

    private async storeCircuitDefinition(
        circuitId: string,
        circuit: FheCircuit,
        executionPlan: any
    ): Promise<void> {
        // Store circuit definition (in practice, this would be stored in database)
        this.logger.log(`Stored circuit ${circuitId}: ${circuit.name}`);
    }

    public async executeCircuit(
        userId: string,
        circuitId: string,
        encryptedInputs: Record<string, string>
    ): Promise<Record<string, string>> {
        this.logger.log(`Executing circuit ${circuitId} for user ${userId}`);

        const user = await this.userRepository.getUserById(userId);
        if (!user?.walletAddress) {
            throw new Error('User wallet not found');
        }

        // Load circuit definition
        const circuit = await this.loadCircuitDefinition(circuitId);
        const evalKey = await this.getEvaluationKey(user.walletAddress, FheScheme.TFHE);

        // Execute circuit operations
        const wireValues = new Map<string, any>();
        
        // Load inputs
        for (const [inputName, encryptedValue] of Object.entries(encryptedInputs)) {
            wireValues.set(inputName, deserializeCiphertext(encryptedValue));
        }

        // Execute gates in topological order
        for (const gate of circuit.gates) {
            const inputs = gate.inputs.map(i => wireValues.get(i));
            const result = await this.executeGate(gate, inputs, evalKey, FheScheme.TFHE);
            wireValues.set(gate.output, result);
        }

        // Collect outputs
        const outputs: Record<string, string> = {};
        for (const outputName of circuit.outputs) {
            const value = wireValues.get(outputName);
            outputs[outputName] = serializeCiphertext(value);
        }

        return outputs;
    }

    private async loadCircuitDefinition(circuitId: string): Promise<FheCircuit> {
        // In practice, load from database
        return {
            name: 'mock-circuit',
            inputs: ['input1', 'input2'],
            outputs: ['output'],
            gates: [
                {
                    operation: 'add',
                    inputs: ['input1', 'input2'],
                    output: 'output'
                }
            ]
        };
    }

    private async executeGate(
        gate: any,
        inputs: any[],
        evalKey: string,
        scheme: FheScheme
    ): Promise<any> {
        const operation: HomomorphicOperation = {
            type: gate.operation,
            inputs: inputs.map(i => serializeCiphertext(i)),
            scheme,
            autoBootstrap: true
        };

        const result = await this.performHomomorphicOperation('system', operation);
        return deserializeCiphertext(result.result);
    }
}
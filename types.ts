export enum FheScheme {
    TFHE = 'tfhe',
    CKKS = 'ckks',
    BGV = 'bgv',
    BFV = 'bfv'
}

export enum SecurityLevel {
    LOW = 128,
    MEDIUM = 192,
    HIGH = 256
}

export interface FheKeyPair {
    publicKey: string;
    privateKey: string;
    evaluationKey: string;
    scheme: FheScheme;
    generatedAt: number;
}

export interface FheEncryptedData {
    fieldName: string;
    encryptedValue: string;
    metadata: CiphertextMetadata;
    publicKeyHash: string;
    transactionHash?: string;
}

export interface CiphertextMetadata {
    scheme: FheScheme;
    securityLevel: SecurityLevel;
    noiseLevel: number;
    bootstrappable: boolean;
    timestamp: number;
    version: string;
    depth?: number;
    size?: number;
}

export interface EncryptionParams {
    fieldName: string;
    value: any;
    dataType: string;
    scheme: FheScheme;
    securityLevel?: SecurityLevel;
    allowBootstrapping?: boolean;
    storeOnChain?: boolean;
}

export interface DecryptionParams {
    fieldName: string;
    encryptedValue: string;
    metadata: CiphertextMetadata;
    originalDataType: string;
}

export interface HomomorphicOperation {
    type: 'add' | 'multiply' | 'subtract' | 'negate' | 'rotate' | 'bootstrap';
    inputs: string[];
    scheme: FheScheme;
    autoBootstrap?: boolean;
    rotationAmount?: number;
}

export interface FheComputationResult {
    result: string;
    operationType: string;
    computationTime: number;
    noiseLevel: number;
    bootstrapped: boolean;
}

export interface BootstrappingKey {
    key: string;
    scheme: FheScheme;
    refreshingKey?: string;
    keySwitchingKey?: string;
}

export interface FheCircuit {
    name: string;
    inputs: string[];
    outputs: string[];
    gates: CircuitGate[];
}

export interface CircuitGate {
    operation: string;
    inputs: string[];
    output: string;
    parameters?: any;
}

export interface RelinearizationKey {
    key: string;
    fromDegree: number;
    toDegree: number;
}

export interface GaloisKey {
    key: string;
    element: number;
    modulus: bigint;
}

export interface FheParameters {
    polynomialModulusDegree: number;
    coefficientModulus: bigint[];
    plaintextModulus: bigint;
    scale?: number;
    noiseStandardDeviation: number;
    securityLevel: SecurityLevel;
}

export interface PackedCiphertext {
    slots: string[];
    packing: 'row' | 'column' | 'diagonal';
    slotCount: number;
    batchSize: number;
}

export interface HomomorphicEvaluation {
    circuit: FheCircuit;
    inputs: Record<string, string>;
    outputs: Record<string, string>;
    evaluationTime: number;
    memoryUsed: number;
    noiseGrowth: number;
}

export interface FheSchemeParameters {
    [FheScheme.TFHE]: {
        n: number;
        k: number;
        N: number;
        baseLog: number;
        levelCount: number;
        stdDev: number;
    };
    [FheScheme.CKKS]: {
        logN: number;
        logQP: number;
        scale: number;
        sigma: number;
        h: number;
    };
    [FheScheme.BGV]: {
        logN: number;
        logQ: number;
        t: bigint;
        sigma: number;
    };
    [FheScheme.BFV]: {
        polyModulusDegree: number;
        plainModulus: bigint;
        coeffModulus: bigint[];
    };
}

export interface NoiseEstimate {
    currentNoise: number;
    maxNoise: number;
    remainingComputations: number;
    requiresBootstrapping: boolean;
}

export interface FheContext {
    scheme: FheScheme;
    parameters: any;
    publicKey?: string;
    privateKey?: string;
    evaluationKey?: string;
    relinKeys?: RelinearizationKey[];
    galoisKeys?: GaloisKey[];
}

export interface EncryptedFieldStorage {
    userId: string;
    walletAddress: string;
    fieldName: string;
    encryptedData: string;
    metadata: CiphertextMetadata;
    createdAt: Date;
    updatedAt: Date;
    accessCount: number;
}

export interface FheAuditLog {
    operationId: string;
    userId: string;
    operationType: 'encrypt' | 'decrypt' | 'compute';
    fieldName?: string;
    scheme: FheScheme;
    timestamp: number;
    success: boolean;
    gasUsed?: number;
    errorMessage?: string;
}

export interface BatchEncryption {
    fields: EncryptionParams[];
    commonScheme: FheScheme;
    packedEncryption: boolean;
    compressionEnabled: boolean;
}

export interface BatchDecryption {
    fields: DecryptionParams[];
    parallelProcessing: boolean;
    errorHandling: 'skip' | 'fail';
}

export interface FhePerformanceMetrics {
    encryptionThroughput: number;
    decryptionThroughput: number;
    homomorphicOpsThroughput: number;
    averageNoiseGrowth: number;
    bootstrappingFrequency: number;
    memoryUsage: number;
    cpuUsage: number;
}
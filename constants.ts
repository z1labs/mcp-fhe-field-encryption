import { ChainNames } from 'modules/blockchain/constants';
import { FheScheme, SecurityLevel } from './types';

export const FHE_CONSTANTS = {
    // TFHE WASM Configuration
    WASM_PATH: '/wasm/tfhe_wasm_bg.wasm',
    THREAD_COUNT: 4,
    MEMORY_SIZE: 2048 * 1024 * 1024, // 2GB

    // Version
    VERSION: '1.0.0',

    // Default settings
    DEFAULT_SECURITY_LEVEL: SecurityLevel.MEDIUM,
    DEFAULT_SCHEME: FheScheme.TFHE,

    // Noise parameters
    BASE_NOISE: 3.2,
    MAX_NOISE_LEVEL: 100,
    NOISE_GROWTH_FACTORS: {
        ADD: 1.1,
        MULTIPLY: 2.5,
        ROTATE: 1.2,
        NEGATE: 1.05,
        BOOTSTRAP: 0.1
    },

    // Ciphertext parameters
    MAX_CIPHERTEXT_SIZE: 3,
    MAX_CIRCUIT_DEPTH: 20,

    // Scheme-specific parameters
    SCHEME_PARAMS: {
        [FheScheme.TFHE]: {
            n: 630,
            k: 1,
            N: 1024,
            baseLog: 7,
            levelCount: 3,
            stdDev: 3.2,
            securityLevel: SecurityLevel.MEDIUM,
            modulusBits: 32,
            plaintextModulus: BigInt(65537),
            noiseStandardDeviation: 3.2
        },
        [FheScheme.CKKS]: {
            logN: 15,
            logQP: 438,
            scale: Math.pow(2, 40),
            sigma: 3.2,
            h: 192,
            securityLevel: SecurityLevel.HIGH,
            modulusBits: 60,
            plaintextModulus: BigInt(0),
            noiseStandardDeviation: 3.2
        },
        [FheScheme.BGV]: {
            logN: 14,
            logQ: 438,
            t: BigInt(65537),
            sigma: 3.2,
            securityLevel: SecurityLevel.MEDIUM,
            modulusBits: 50,
            plaintextModulus: BigInt(65537),
            noiseStandardDeviation: 3.2
        },
        [FheScheme.BFV]: {
            polyModulusDegree: 4096,
            plainModulus: BigInt(786433),
            coeffModulus: [
                BigInt('0xffffee001'),
                BigInt('0xffffc4001'),
                BigInt('0x1ffffe0001')
            ],
            securityLevel: SecurityLevel.MEDIUM,
            modulusBits: 40,
            plaintextModulus: BigInt(786433),
            noiseStandardDeviation: 3.2
        }
    },

    // Storage contract addresses
    STORAGE_CONTRACT: '0xfhe1234567890123456789012345678901234567',
    
    ENCRYPTION_CONTRACTS: {
        [ChainNames.CYPHER]: '0xfhe2345678901234567890123456789012345678',
        [ChainNames.ETHEREUM]: '0xfhe3456789012345678901234567890123456789',
        [ChainNames.ARBITRUM]: '0xfhe4567890123456789012345678901234567890'
    },

    // Gas limits
    GAS_LIMITS: {
        ENCRYPT: 300000,
        DECRYPT: 250000,
        HOMOMORPHIC_OP: 500000,
        BOOTSTRAP: 1000000,
        STORE_ENCRYPTED: 200000
    },

    // Batch processing
    MAX_BATCH_SIZE: 50,
    BATCH_TIMEOUT: 30000, // 30 seconds

    // Cache settings
    KEY_CACHE_TTL: 3600000, // 1 hour
    BOOTSTRAP_KEY_CACHE_TTL: 7200000, // 2 hours

    // Storage ABI
    STORAGE_ABI: [
        {
            "inputs": [
                {
                    "internalType": "address",
                    "name": "user",
                    "type": "address"
                },
                {
                    "internalType": "bytes32",
                    "name": "fieldName",
                    "type": "bytes32"
                },
                {
                    "internalType": "string",
                    "name": "encryptedValue",
                    "type": "string"
                },
                {
                    "internalType": "bytes",
                    "name": "metadata",
                    "type": "bytes"
                }
            ],
            "name": "storeEncryptedField",
            "outputs": [],
            "stateMutability": "nonpayable",
            "type": "function"
        },
        {
            "inputs": [
                {
                    "internalType": "address",
                    "name": "user",
                    "type": "address"
                },
                {
                    "internalType": "bytes32",
                    "name": "fieldName",
                    "type": "bytes32"
                }
            ],
            "name": "getEncryptedField",
            "outputs": [
                {
                    "components": [
                        {
                            "internalType": "string",
                            "name": "encryptedValue",
                            "type": "string"
                        },
                        {
                            "internalType": "bytes",
                            "name": "metadata",
                            "type": "bytes"
                        },
                        {
                            "internalType": "uint256",
                            "name": "timestamp",
                            "type": "uint256"
                        }
                    ],
                    "internalType": "struct EncryptedField",
                    "name": "",
                    "type": "tuple"
                }
            ],
            "stateMutability": "view",
            "type": "function"
        }
    ],

    // Error messages
    ERROR_MESSAGES: {
        INITIALIZATION_FAILED: 'Failed to initialize FHE system',
        INVALID_SCHEME: 'Invalid FHE scheme specified',
        KEY_GENERATION_FAILED: 'Failed to generate FHE keys',
        ENCRYPTION_FAILED: 'Encryption operation failed',
        DECRYPTION_FAILED: 'Decryption operation failed',
        NOISE_OVERFLOW: 'Noise level exceeded maximum threshold',
        BOOTSTRAPPING_REQUIRED: 'Ciphertext requires bootstrapping',
        INVALID_CIPHERTEXT: 'Invalid ciphertext format',
        KEY_NOT_FOUND: 'FHE keys not found for user',
        CIRCUIT_TOO_DEEP: 'Circuit depth exceeds maximum',
        BATCH_SIZE_EXCEEDED: 'Batch size exceeds maximum limit'
    },

    // Polynomial parameters
    POLY_MODULUS_DEGREE: {
        1024: { securityLevel: 27, maxCoeffModulusBitCount: 27 },
        2048: { securityLevel: 54, maxCoeffModulusBitCount: 54 },
        4096: { securityLevel: 109, maxCoeffModulusBitCount: 109 },
        8192: { securityLevel: 218, maxCoeffModulusBitCount: 218 },
        16384: { securityLevel: 438, maxCoeffModulusBitCount: 438 },
        32768: { securityLevel: 881, maxCoeffModulusBitCount: 881 }
    },

    // Coefficient modulus bit sizes for different security levels
    COEFF_MODULUS_128: {
        1024: [27],
        2048: [54],
        4096: [109],
        8192: [218],
        16384: [438],
        32768: [881]
    },

    COEFF_MODULUS_192: {
        1024: [19],
        2048: [37],
        4096: [75],
        8192: [152],
        16384: [305],
        32768: [611]
    },

    COEFF_MODULUS_256: {
        1024: [14],
        2048: [29],
        4096: [58],
        8192: [118],
        16384: [237],
        32768: [476]
    },

    // SIMD slot counts
    SIMD_SLOT_COUNT: {
        [FheScheme.CKKS]: 8192,
        [FheScheme.BGV]: 4096,
        [FheScheme.BFV]: 4096,
        [FheScheme.TFHE]: 1
    },

    // Bootstrapping parameters
    BOOTSTRAP_PARAMS: {
        [FheScheme.TFHE]: {
            baseLog: 25,
            levelCount: 2,
            bootstrappingKeySize: 1024 * 1024, // 1MB
            refreshingKeySize: 512 * 1024 // 512KB
        },
        [FheScheme.CKKS]: {
            levelBudget: 3,
            scalingFactor: Math.pow(2, 40),
            bootstrappingPrecision: 25
        }
    },

    // Performance benchmarks (operations per second)
    PERFORMANCE_TARGETS: {
        ENCRYPT: 1000,
        DECRYPT: 1000,
        ADD: 10000,
        MULTIPLY: 1000,
        BOOTSTRAP: 10
    }
} as const;
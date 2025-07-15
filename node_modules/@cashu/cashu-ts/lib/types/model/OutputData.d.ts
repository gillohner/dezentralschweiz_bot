import { MintKeys, Proof, SerializedBlindedMessage, SerializedBlindedSignature } from './types';
export interface OutputDataLike {
    blindedMessage: SerializedBlindedMessage;
    blindingFactor: bigint;
    secret: Uint8Array;
    toProof: (signature: SerializedBlindedSignature, keyset: MintKeys) => Proof;
}
export type OutputDataFactory = (amount: number, keys: MintKeys) => OutputDataLike;
export declare function isOutputDataFactory(value: Array<OutputData> | OutputDataFactory): value is OutputDataFactory;
export declare class OutputData implements OutputDataLike {
    blindedMessage: SerializedBlindedMessage;
    blindingFactor: bigint;
    secret: Uint8Array;
    constructor(blindedMessage: SerializedBlindedMessage, blidingFactor: bigint, secret: Uint8Array);
    toProof(sig: SerializedBlindedSignature, keyset: MintKeys): Proof;
    static createP2PKData(p2pk: {
        pubkey: string;
        locktime?: number;
        refundKeys?: Array<string>;
    }, amount: number, keyset: MintKeys, customSplit?: Array<number>): OutputData[];
    static createSingleP2PKData(p2pk: {
        pubkey: string;
        locktime?: number;
        refundKeys?: Array<string>;
    }, amount: number, keysetId: string): OutputData;
    static createRandomData(amount: number, keyset: MintKeys, customSplit?: Array<number>): OutputData[];
    static createSingleRandomData(amount: number, keysetId: string): OutputData;
    static createDeterministicData(amount: number, seed: Uint8Array, counter: number, keyset: MintKeys, customSplit?: Array<number>): Array<OutputData>;
    static createSingleDeterministicData(amount: number, seed: Uint8Array, counter: number, keysetId: string): OutputData;
}

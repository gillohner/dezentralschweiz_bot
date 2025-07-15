import { PaymentRequest } from './model/PaymentRequest.js';
import { Keys, MintKeys, Proof, Token } from './model/types/index.js';
/**
 * Splits the amount into denominations of the provided @param keyset
 * @param value amount to split
 * @param keyset keys to look up split amounts
 * @param split? optional custom split amounts
 * @param order? optional order for split amounts (default: "asc")
 * @returns Array of split amounts
 * @throws Error if @param split amount is greater than @param value amount
 */
export declare function splitAmount(value: number, keyset: Keys, split?: Array<number>, order?: 'desc' | 'asc'): Array<number>;
/**
 * Creates a list of amounts to keep based on the proofs we have and the proofs we want to reach.
 * @param proofsWeHave complete set of proofs stored (from current mint)
 * @param amountToKeep amount to keep
 * @param keys keys of current keyset
 * @param targetCount the target number of proofs to reach
 * @returns an array of amounts to keep
 */
export declare function getKeepAmounts(proofsWeHave: Array<Proof>, amountToKeep: number, keys: Keys, targetCount: number): Array<number>;
/**
 * returns the amounts in the keyset sorted by the order specified
 * @param keyset to search in
 * @param order order to sort the amounts in
 * @returns the amounts in the keyset sorted by the order specified
 */
export declare function getKeysetAmounts(keyset: Keys, order?: 'asc' | 'desc'): Array<number>;
/**
 * Checks if the provided amount is in the keyset.
 * @param amount amount to check
 * @param keyset to search in
 * @returns true if the amount is in the keyset, false otherwise
 */
export declare function hasCorrespondingKey(amount: number, keyset: Keys): boolean;
/**
 * Converts a bytes array to a number.
 * @param bytes to convert to number
 * @returns  number
 */
export declare function bytesToNumber(bytes: Uint8Array): bigint;
/**
 * Converts a hex string to a number.
 * @param hex to convert to number
 * @returns number
 */
export declare function hexToNumber(hex: string): bigint;
/**
 * Converts a number to a hex string of 64 characters.
 * @param number (bigint) to conver to hex
 * @returns hex string start-padded to 64 characters
 */
export declare function numberToHexPadded64(number: bigint): string;
/**
 * Checks wether a proof or a list of proofs contains a non-hex id
 * @param p Proof or list of proofs
 * @returns boolean
 */
export declare function hasNonHexId(p: Proof | Array<Proof>): boolean;
export declare function bigIntStringify<T>(_key: unknown, value: T): string | T;
/**
 * Helper function to encode a v3 cashu token
 * @param token to encode
 * @returns encoded token
 */
export declare function getEncodedTokenV3(token: Token): string;
/**
 * Helper function to encode a cashu token (defaults to v4 if keyset id allows it)
 * @param token
 * @param [opts]
 */
export declare function getEncodedToken(token: Token, opts?: {
    version: 3 | 4;
}): string;
export declare function getEncodedTokenV4(token: Token): string;
/**
 * Helper function to decode cashu tokens into object
 * @param token an encoded cashu token (cashuAey...)
 * @returns cashu token object
 */
export declare function getDecodedToken(token: string): Token;
/**
 * Helper function to decode different versions of cashu tokens into an object
 * @param token an encoded cashu token (cashuAey...)
 * @returns cashu Token object
 */
export declare function handleTokens(token: string): Token;
/**
 * Returns the keyset id of a set of keys
 * @param keys keys object to derive keyset id from
 * @returns
 */
export declare function deriveKeysetId(keys: Keys): string;
export declare function mergeUInt8Arrays(a1: Uint8Array, a2: Uint8Array): Uint8Array;
export declare function sortProofsById(proofs: Array<Proof>): Proof[];
export declare function isObj(v: unknown): v is object;
export declare function checkResponse(data: {
    error?: string;
    detail?: string;
}): void;
export declare function joinUrls(...parts: Array<string>): string;
export declare function sanitizeUrl(url: string): string;
export declare function sumProofs(proofs: Array<Proof>): number;
export declare function decodePaymentRequest(paymentRequest: string): PaymentRequest;
export declare class MessageNode {
    private _value;
    private _next;
    get value(): string;
    set value(message: string);
    get next(): MessageNode | null;
    set next(node: MessageNode | null);
    constructor(message: string);
}
export declare class MessageQueue {
    private _first;
    private _last;
    get first(): MessageNode | null;
    set first(messageNode: MessageNode | null);
    get last(): MessageNode | null;
    set last(messageNode: MessageNode | null);
    private _size;
    get size(): number;
    set size(v: number);
    constructor();
    enqueue(message: string): boolean;
    dequeue(): string | null;
}
/**
 * Removes all traces of DLEQs from a list of proofs
 * @param proofs The list of proofs that dleq should be stripped from
 */
export declare function stripDleq(proofs: Array<Proof>): Array<Omit<Proof, 'dleq'>>;
/**
 * Checks that the proof has a valid DLEQ proof according to
 * keyset `keys`
 * @param proof The proof subject to verification
 * @param keyset The Mint's keyset to be used for verification
 * @returns true if verification succeeded, false otherwise
 * @throws Error if @param proof does not match any key in @param keyset
 */
export declare function hasValidDleq(proof: Proof, keyset: MintKeys): boolean;
/**
 * Helper function to encode a cashu auth token authA
 * @param proof
 */
export declare function getEncodedAuthToken(proof: Proof): string;
export declare function getEncodedTokenBinary(token: Token): Uint8Array;
export declare function getDecodedTokenBinary(bytes: Uint8Array): Token;

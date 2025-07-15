import { MintKeys, MintKeyset, Proof } from '../model/types';
import { CashuAuthMint } from './CashuAuthMint';
/**
 * Class that represents a Cashu NUT-22 wallet.
 */
declare class CashuAuthWallet {
    private _keys;
    private _keysetId;
    private _keysets;
    private _unit;
    mint: CashuAuthMint;
    /**
     * @param mint NUT-22 auth mint instance
     * @param options.keys public keys from the mint (will be fetched from mint if not provided)
     * @param options.keysets keysets from the mint (will be fetched from mint if not provided)
     */
    constructor(mint: CashuAuthMint, options?: {
        keys?: Array<MintKeys> | MintKeys;
        keysets?: Array<MintKeyset>;
    });
    get keys(): Map<string, MintKeys>;
    get keysetId(): string;
    set keysetId(keysetId: string);
    get keysets(): Array<MintKeyset>;
    /**
     * Load mint information, keysets and keys. This function can be called if no keysets are passed in the constructor
     */
    loadMint(): Promise<void>;
    /**
     * Choose a keyset to activate based on the lowest input fee
     *
     * Note: this function will filter out deprecated base64 keysets
     *
     * @param keysets keysets to choose from
     * @returns active keyset
     */
    getActiveKeyset(keysets: Array<MintKeyset>): MintKeyset;
    /**
     * Get keysets from the mint with the unit of the wallet
     * @returns keysets with wallet's unit
     */
    getKeySets(): Promise<Array<MintKeyset>>;
    /**
     * Get all active keys from the mint and set the keyset with the lowest fees as the active wallet keyset.
     * @returns keyset
     */
    getAllKeys(): Promise<Array<MintKeys>>;
    /**
     * Get public keys from the mint. If keys were already fetched, it will return those.
     *
     * If `keysetId` is set, it will fetch and return that specific keyset.
     * Otherwise, we select an active keyset with the unit of the wallet.
     *
     * @param keysetId optional keysetId to get keys for
     * @param forceRefresh? if set to true, it will force refresh the keyset from the mint
     * @returns keyset
     */
    getKeys(keysetId?: string, forceRefresh?: boolean): Promise<MintKeys>;
    /**
     * Mint proofs for a given mint quote
     * @param amount amount to request
     * @param clearAuthToken clearAuthToken to mint
     * @param options.keysetId? optionally set keysetId for blank outputs for returned change.
     * @returns proofs
     */
    mintProofs(amount: number, clearAuthToken: string, options?: {
        keysetId?: string;
    }): Promise<Array<Proof>>;
}
export { CashuAuthWallet };

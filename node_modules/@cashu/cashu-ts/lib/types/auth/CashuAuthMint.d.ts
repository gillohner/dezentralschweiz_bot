import { BlindAuthMintPayload, BlindAuthMintResponse, MintActiveKeys, MintAllKeysets } from '../model/types';
import { default as request } from '../request';
/**
 * Class represents Cashu Auth Mint API. This class contains Lower level functions that are implemented by CashuAuthWallet.
 */
declare class CashuAuthMint {
    private _mintUrl;
    private _customRequest?;
    /**
     * @param _mintUrl requires mint URL to create this object
     * @param _customRequest if passed, use custom request implementation for network communication with the mint
     */
    constructor(_mintUrl: string, _customRequest?: typeof request | undefined);
    get mintUrl(): string;
    /**
     * Mints new Blinded Authentication tokens by requesting blind signatures on the provided outputs.
     * @param mintUrl
     * @param mintPayload Payload containing the outputs to get blind signatures on
     * @param clearAuthToken A NUT-21 clear auth token
     * @param customRequest
     * @returns serialized blinded signatures
     */
    static mint(mintUrl: string, mintPayload: BlindAuthMintPayload, clearAuthToken: string, customRequest?: typeof request): Promise<BlindAuthMintResponse>;
    /**
     * Mints new Blinded Authentication tokens by requesting blind signatures on the provided outputs.
     * @param mintPayload Payload containing the outputs to get blind signatures on
     * @param clearAuthToken A NUT-21 clear auth token
     * @returns serialized blinded signatures
     */
    mint(mintPayload: BlindAuthMintPayload, clearAuthToken: string): Promise<BlindAuthMintResponse>;
    /**
     * Get the mints public NUT-22 keys
     * @param mintUrl
     * @param keysetId optional param to get the keys for a specific keyset. If not specified, the keys from all active keysets are fetched
     * @param customRequest
     * @returns
     */
    static getKeys(mintUrl: string, keysetId?: string, customRequest?: typeof request): Promise<MintActiveKeys>;
    /**
     * Get the mints public NUT-22 keys
     * @param keysetId optional param to get the keys for a specific keyset. If not specified, the keys from all active keysets are fetched
     * @returns the mints public keys
     */
    getKeys(keysetId?: string, mintUrl?: string): Promise<MintActiveKeys>;
    /**
     * Get the mints NUT-22 keysets in no specific order
     * @param mintUrl
     * @param customRequest
     * @returns all the mints past and current keysets.
     */
    static getKeySets(mintUrl: string, customRequest?: typeof request): Promise<MintAllKeysets>;
    /**
     * Get the mints NUT-22 keysets in no specific order
     * @returns all the mints past and current keysets.
     */
    getKeySets(): Promise<MintAllKeysets>;
}
export { CashuAuthMint };

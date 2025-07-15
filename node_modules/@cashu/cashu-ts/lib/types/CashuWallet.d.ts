import { CashuMint } from './CashuMint.js';
import { MintInfo } from './model/MintInfo.js';
import { GetInfoResponse, MeltProofOptions, MintProofOptions, MintQuoteResponse, ProofState, ReceiveOptions, RestoreOptions, SendOptions, SwapOptions, MeltProofsResponse, MeltQuoteResponse, MintKeys, MintKeyset, Proof, SendResponse, Token, LockedMintQuoteResponse, PartialMintQuoteResponse, PartialMeltQuoteResponse } from './model/types/index.js';
import { SubscriptionCanceller } from './model/types/wallet/websocket.js';
import { OutputDataFactory } from './model/OutputData.js';
/**
 * Class that represents a Cashu wallet.
 * This class should act as the entry point for this library
 */
declare class CashuWallet {
    private _keys;
    private _keysetId;
    private _keysets;
    private _seed;
    private _unit;
    private _mintInfo;
    private _denominationTarget;
    private _keepFactory;
    mint: CashuMint;
    /**
     * @param mint Cashu mint instance is used to make api calls
     * @param options.unit optionally set unit (default is 'sat')
     * @param options.keys public keys from the mint (will be fetched from mint if not provided)
     * @param options.keysets keysets from the mint (will be fetched from mint if not provided)
     * @param options.mintInfo mint info from the mint (will be fetched from mint if not provided)
     * @param options.denominationTarget target number proofs per denomination (default: see @constant DEFAULT_DENOMINATION_TARGET)
     * @param options.bip39seed BIP39 seed for deterministic secrets.
     * @param options.keepFactory A function that will be used by all parts of the library that produce proofs to be kept (change, etc.).
     * This can lead to poor performance, in which case the seed should be directly provided
     */
    constructor(mint: CashuMint, options?: {
        unit?: string;
        keys?: Array<MintKeys> | MintKeys;
        keysets?: Array<MintKeyset>;
        mintInfo?: GetInfoResponse;
        bip39seed?: Uint8Array;
        denominationTarget?: number;
        keepFactory?: OutputDataFactory;
    });
    get unit(): string;
    get keys(): Map<string, MintKeys>;
    get keysetId(): string;
    set keysetId(keysetId: string);
    get keysets(): Array<MintKeyset>;
    get mintInfo(): MintInfo;
    /**
     * Get information about the mint
     * @returns mint info
     */
    getMintInfo(): Promise<MintInfo>;
    /**
     * Get stored information about the mint or request it if not loaded.
     * @returns mint info
     */
    lazyGetMintInfo(): Promise<MintInfo>;
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
     * Receive an encoded or raw Cashu token (only supports single tokens. It will only process the first token in the token array)
     * @param {(string|Token)} token - Cashu token, either as string or decoded
     * @param {ReceiveOptions} [options] - Optional configuration for token processing
     * @returns New token with newly created proofs, token entries that had errors
     */
    receive(token: string | Token, options?: ReceiveOptions): Promise<Array<Proof>>;
    /**
     * Send proofs of a given amount, by providing at least the required amount of proofs
     * @param amount amount to send
     * @param proofs array of proofs (accumulated amount of proofs must be >= than amount)
     * @param {SendOptions} [options] - Optional parameters for configuring the send operation
     * @returns {SendResponse}
     */
    send(amount: number, proofs: Array<Proof>, options?: SendOptions): Promise<SendResponse>;
    selectProofsToSend(proofs: Array<Proof>, amountToSend: number, includeFees?: boolean): SendResponse;
    /**
     * calculates the fees based on inputs (proofs)
     * @param proofs input proofs to calculate fees for
     * @returns fee amount
     */
    getFeesForProofs(proofs: Array<Proof>): number;
    /**
     * calculates the fees based on inputs for a given keyset
     * @param nInputs number of inputs
     * @param keysetId keysetId used to lookup `input_fee_ppk`
     * @returns fee amount
     */
    getFeesForKeyset(nInputs: number, keysetId: string): number;
    /**
     * Splits and creates sendable tokens
     * if no amount is specified, the amount is implied by the cumulative amount of all proofs
     * if both amount and preference are set, but the preference cannot fulfill the amount, then we use the default split
     *  @param {SwapOptions} [options] - Optional parameters for configuring the swap operation
     * @returns promise of the change- and send-proofs
     */
    swap(amount: number, proofs: Array<Proof>, options?: SwapOptions): Promise<SendResponse>;
    /**
     * Restores batches of deterministic proofs until no more signatures are returned from the mint
     * @param [gapLimit=300] the amount of empty counters that should be returned before restoring ends (defaults to 300)
     * @param [batchSize=100] the amount of proofs that should be restored at a time (defaults to 100)
     * @param [counter=0] the counter that should be used as a starting point (defaults to 0)
     * @param [keysetId] which keysetId to use for the restoration. If none is passed the instance's default one will be used
     */
    batchRestore(gapLimit?: number, batchSize?: number, counter?: number, keysetId?: string): Promise<{
        proofs: Array<Proof>;
        lastCounterWithSignature?: number;
    }>;
    /**
     * Regenerates
     * @param start set starting point for count (first cycle for each keyset should usually be 0)
     * @param count set number of blinded messages that should be generated
     * @param options.keysetId set a custom keysetId to restore from. keysetIds can be loaded with `CashuMint.getKeySets()`
     */
    restore(start: number, count: number, options?: RestoreOptions): Promise<{
        proofs: Array<Proof>;
        lastCounterWithSignature?: number;
    }>;
    /**
     * Requests a mint quote form the mint. Response returns a Lightning payment request for the requested given amount and unit.
     * @param amount Amount requesting for mint.
     * @param description optional description for the mint quote
     * @param pubkey optional public key to lock the quote to
     * @returns the mint will return a mint quote with a Lightning invoice for minting tokens of the specified amount and unit
     */
    createMintQuote(amount: number, description?: string): Promise<MintQuoteResponse>;
    /**
     * Requests a mint quote from the mint that is locked to a public key.
     * @param amount Amount requesting for mint.
     * @param pubkey public key to lock the quote to
     * @param description optional description for the mint quote
     * @returns the mint will return a mint quote with a Lightning invoice for minting tokens of the specified amount and unit.
     * The quote will be locked to the specified `pubkey`.
     */
    createLockedMintQuote(amount: number, pubkey: string, description?: string): Promise<LockedMintQuoteResponse>;
    /**
     * Gets an existing mint quote from the mint.
     * @param quote Quote ID
     * @returns the mint will create and return a Lightning invoice for the specified amount
     */
    checkMintQuote(quote: MintQuoteResponse): Promise<MintQuoteResponse>;
    checkMintQuote(quote: string): Promise<PartialMintQuoteResponse>;
    /**
     * Mint proofs for a given mint quote
     * @param amount amount to request
     * @param {string} quote - ID of mint quote (when quote is a string)
     * @param {LockedMintQuote} quote - containing the quote ID and unlocking private key (when quote is a LockedMintQuote)
     * @param {MintProofOptions} [options] - Optional parameters for configuring the Mint Proof operation
     * @returns proofs
     */
    mintProofs(amount: number, quote: MintQuoteResponse, options: MintProofOptions & {
        privateKey: string;
    }): Promise<Array<Proof>>;
    mintProofs(amount: number, quote: string, options?: MintProofOptions): Promise<Array<Proof>>;
    /**
     * Requests a melt quote from the mint. Response returns amount and fees for a given unit in order to pay a Lightning invoice.
     * @param invoice LN invoice that needs to get a fee estimate
     * @returns the mint will create and return a melt quote for the invoice with an amount and fee reserve
     */
    createMeltQuote(invoice: string): Promise<MeltQuoteResponse>;
    /**
     * Requests a multi path melt quote from the mint.
     * @param invoice LN invoice that needs to get a fee estimate
     * @param partialAmount the partial amount of the invoice's total to be paid by this instance
     * @returns the mint will create and return a melt quote for the invoice with an amount and fee reserve
     */
    createMultiPathMeltQuote(invoice: string, millisatPartialAmount: number): Promise<MeltQuoteResponse>;
    /**
     * Return an existing melt quote from the mint.
     * @param quote ID of the melt quote
     * @returns the mint will return an existing melt quote
     */
    checkMeltQuote(quote: string): Promise<PartialMeltQuoteResponse>;
    checkMeltQuote(quote: MeltQuoteResponse): Promise<MeltQuoteResponse>;
    /**
     * Melt proofs for a melt quote. proofsToSend must be at least amount+fee_reserve form the melt quote. This function does not perform coin selection!.
     * Returns melt quote and change proofs
     * @param meltQuote ID of the melt quote
     * @param proofsToSend proofs to melt
     * @param {MeltProofOptions} [options] - Optional parameters for configuring the Melting Proof operation
     * @returns
     */
    meltProofs(meltQuote: MeltQuoteResponse, proofsToSend: Array<Proof>, options?: MeltProofOptions): Promise<MeltProofsResponse>;
    /**
     * Creates a split payload
     * @param amount amount to send
     * @param proofsToSend proofs to split*
     * @param outputAmounts? optionally specify the output's amounts to keep and to send.
     * @param counter? optionally set counter to derive secret deterministically. CashuWallet class must be initialized with seed phrase to take effect
     * @param pubkey? optionally locks ecash to pubkey. Will not be deterministic, even if counter is set!
     * @param privkey? will create a signature on the @param proofsToSend secrets if set
     * @returns
     */
    private createSwapPayload;
    /**
     * Get an array of the states of proofs from the mint (as an array of CheckStateEnum's)
     * @param proofs (only the `secret` field is required)
     * @returns
     */
    checkProofsStates(proofs: Array<Proof>): Promise<Array<ProofState>>;
    /**
     * Register a callback to be called whenever a mint quote's state changes
     * @param quoteIds List of mint quote IDs that should be subscribed to
     * @param callback Callback function that will be called whenever a mint quote state changes
     * @param errorCallback
     * @returns
     */
    onMintQuoteUpdates(quoteIds: Array<string>, callback: (payload: MintQuoteResponse) => void, errorCallback: (e: Error) => void): Promise<SubscriptionCanceller>;
    /**
     * Register a callback to be called whenever a melt quote's state changes
     * @param quoteIds List of melt quote IDs that should be subscribed to
     * @param callback Callback function that will be called whenever a melt quote state changes
     * @param errorCallback
     * @returns
     */
    onMeltQuotePaid(quoteId: string, callback: (payload: MeltQuoteResponse) => void, errorCallback: (e: Error) => void): Promise<SubscriptionCanceller>;
    /**
     * Register a callback to be called when a single mint quote gets paid
     * @param quoteId Mint quote id that should be subscribed to
     * @param callback Callback function that will be called when this mint quote gets paid
     * @param errorCallback
     * @returns
     */
    onMintQuotePaid(quoteId: string, callback: (payload: MintQuoteResponse) => void, errorCallback: (e: Error) => void): Promise<SubscriptionCanceller>;
    /**
     * Register a callback to be called when a single melt quote gets paid
     * @param quoteId Melt quote id that should be subscribed to
     * @param callback Callback function that will be called when this melt quote gets paid
     * @param errorCallback
     * @returns
     */
    onMeltQuoteUpdates(quoteIds: Array<string>, callback: (payload: MeltQuoteResponse) => void, errorCallback: (e: Error) => void): Promise<SubscriptionCanceller>;
    /**
     * Register a callback to be called whenever a subscribed proof state changes
     * @param proofs List of proofs that should be subscribed to
     * @param callback Callback function that will be called whenever a proof's state changes
     * @param errorCallback
     * @returns
     */
    onProofStateUpdates(proofs: Array<Proof>, callback: (payload: ProofState & {
        proof: Proof;
    }) => void, errorCallback: (e: Error) => void): Promise<SubscriptionCanceller>;
    /**
     * Creates blinded messages for a according to @param amounts
     * @param amount array of amounts to create blinded messages for
     * @param counter? optionally set counter to derive secret deterministically. CashuWallet class must be initialized with seed phrase to take effect
     * @param keyksetId? override the keysetId derived from the current mintKeys with a custom one. This should be a keyset that was fetched from the `/keysets` endpoint
     * @param pubkey? optionally locks ecash to pubkey. Will not be deterministic, even if counter is set!
     * @returns blinded messages, secrets, rs, and amounts
     */
    private createOutputData;
    /**
     * Creates NUT-08 blank outputs (fee returns) for a given fee reserve
     * See: https://github.com/cashubtc/nuts/blob/main/08.md
     * @param amount amount to cover with blank outputs
     * @param keysetId mint keysetId
     * @param counter? optionally set counter to derive secret deterministically. CashuWallet class must be initialized with seed phrase to take effect
     * @returns blinded messages, secrets, and rs
     */
    private createBlankOutputs;
}
export { CashuWallet };

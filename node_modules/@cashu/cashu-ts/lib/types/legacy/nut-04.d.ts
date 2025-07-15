import { PartialMintQuoteResponse } from '../model/types/index.js';
export type MintQuoteResponsePaidDeprecated = {
    paid?: boolean;
};
export declare function handleMintQuoteResponseDeprecated(response: PartialMintQuoteResponse & MintQuoteResponsePaidDeprecated): PartialMintQuoteResponse;

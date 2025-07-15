import { PartialMeltQuoteResponse } from '../model/types/index.js';
export type MeltQuoteResponsePaidDeprecated = {
    paid?: boolean;
};
export declare function handleMeltQuoteResponseDeprecated(response: PartialMeltQuoteResponse & MeltQuoteResponsePaidDeprecated): PartialMeltQuoteResponse;

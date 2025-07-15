import { SerializedBlindedMessage } from '../../model/types';
export declare function signMintQuote(privkey: string, quote: string, blindedMessages: Array<SerializedBlindedMessage>): string;
export declare function verifyMintQuoteSignature(pubkey: string, quote: string, blindedMessages: Array<SerializedBlindedMessage>, signature: string): boolean;

import { ProjPointType } from '@noble/curves/abstract/weierstrass';
import { SerializedBlindedSignature } from './types/index.js';
import { DLEQ } from '../crypto/common/index.js';
declare class BlindedSignature {
    id: string;
    amount: number;
    C_: ProjPointType<bigint>;
    dleq?: DLEQ;
    constructor(id: string, amount: number, C_: ProjPointType<bigint>, dleq?: DLEQ);
    getSerializedBlindedSignature(): SerializedBlindedSignature;
}
export { BlindedSignature };

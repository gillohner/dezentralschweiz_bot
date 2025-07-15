import { DLEQ } from '../common/index.js';
import { ProjPointType } from '@noble/curves/abstract/weierstrass';
export declare const verifyDLEQProof: (dleq: DLEQ, B_: ProjPointType<bigint>, C_: ProjPointType<bigint>, A: ProjPointType<bigint>) => boolean;
export declare const verifyDLEQProof_reblind: (secret: Uint8Array, dleq: DLEQ, C: ProjPointType<bigint>, A: ProjPointType<bigint>) => boolean;

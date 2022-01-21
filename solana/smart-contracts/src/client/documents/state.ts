import {Schema} from 'borsh';
import {SolanaBorsh} from '../solanaBorsh';
import {PublicKey} from '@solana/web3.js';
import BN from 'bn.js';

// Receiver account
export type ReceiverType = Omit<Receiver, 'assign' | 'encode'>;

export class Receiver extends SolanaBorsh {
  documents_counter = 0;

  static ACCOUNT_ADDRESS_SEED = 'receiver';

  static schema: Schema = new Map([
    [
      Receiver,
      {
        kind: 'struct',
        fields: [
          ['documents_counter', 'u32'],
        ],
      },
    ],
  ]);

  constructor(properties: ReceiverType | undefined = undefined) {
    super(Receiver.schema);

    if (properties) {
      this.assign(properties);
    }
  }

  static async findPdaAddress(
    receiverAddress: PublicKey,
    programId: PublicKey,
  ): Promise<PublicKey> {
    const publicKeyNonce = await PublicKey.findProgramAddress(
      [
        receiverAddress.toBuffer(),
        Buffer.from(Receiver.ACCOUNT_ADDRESS_SEED),
      ],
      programId,
    );

    return publicKeyNonce[0];
  }
}

// Document account
export type DocumentType = Omit<Document, 'assign' | 'encode'>;

export class Document extends SolanaBorsh {
  sender: PublicKey | undefined;
  data: Uint8Array | undefined;
  sent_at: BN | undefined;
  opened_at: BN | undefined;

  static ACCOUNT_ADDRESS_SEED = 'document';

  static schema: Schema = new Map([
    [
      Document,
      {
        kind: 'struct',
        fields: [
          ['sender', [32]],
          ['data', ['u8']],
          ['sent_at', 'u64'],
          ['opened_at', 'u64'],
        ],
      },
    ],
  ]);

  constructor(properties: DocumentType) {
    super(Document.schema);

    if (properties) {
      this.assign(properties);
    }
  }

  static async findPdaAddress(
    documentIndex: number,
    receiverAddress: PublicKey,
    programId: PublicKey,
  ): Promise<PublicKey> {
    const publicKeyNonce = await PublicKey.findProgramAddress(
      [
        receiverAddress.toBuffer(),
        Buffer.from(documentIndex.toString() + Document.ACCOUNT_ADDRESS_SEED),
      ],
      programId,
    );

    return publicKeyNonce[0];
  }
}

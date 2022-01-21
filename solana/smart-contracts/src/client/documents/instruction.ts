import {Schema, SolanaBorsh} from '../solanaBorsh';

export enum DocumentsInstruction {
  CreateReceiverAccount = 'CreateReceiverAccount',
  SendDocument = 'SendDocument',
}

export class Instruction extends SolanaBorsh {
  constructor(prop: any) {
    const len = prop[prop['instruction']] != null ? prop[prop['instruction']].length : 0;
    const schema: Schema = new Map([
      [
        Instruction,
        {
          kind: 'enum',
          field: 'instruction',
          values: [
            [DocumentsInstruction.CreateReceiverAccount, [len]],
            [DocumentsInstruction.SendDocument, [len]],
          ],
        },
      ],
    ]);

    super(schema);
    this.assign(prop);
  }
}

export class InstructionData extends SolanaBorsh {
  static schema: Record<DocumentsInstruction, Schema> = {
    [DocumentsInstruction.CreateReceiverAccount]: new Map([
      [
        InstructionData,
        {
          kind: 'struct',
          fields: [],
        },
      ],
    ]),
    [DocumentsInstruction.SendDocument]: new Map([
      [
        InstructionData,
        {
          kind: 'struct',
          fields: [
            ['data', ['u8']],
          ],
        },
      ],
    ]),
  };

  constructor(instructionType: DocumentsInstruction, prop: any) {
    super(InstructionData.schema[instructionType]);
    this.assign(prop);
  }
}

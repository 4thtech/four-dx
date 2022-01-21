import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
  TransactionSignature,
} from '@solana/web3.js';
import {Document, Receiver} from './state';
import {
  DocumentsInstruction,
  Instruction,
  InstructionData,
} from './instruction';
import BN from 'bn.js';

// TODO: rename type?
type SolDocument = {
  index: number,
  sender: string,
  data: string,
  sent_at: string,
  opened_at: string,
};

export class Service {
  connection: Connection;

  programId: PublicKey;

  payer: Keypair;

  constructor(connection: Connection, programId: PublicKey, payer: Keypair) {
    this.connection = connection;
    this.programId = programId;
    this.payer = payer;
  }

  public async sendDocument(
    receiverWalletAddress: PublicKey,
    documentData: Uint8Array,
  ): Promise<TransactionSignature> {
    console.log('Send document to', receiverWalletAddress.toBase58());

    // Create receiver PDA account
    const receiverPdaAddress = await this.createReceiverPdaAccount(receiverWalletAddress);

    // Get next available document index
    const documentIndex = await this.getDocumentsCounter(receiverPdaAddress);

    // Get document PDA account address
    const documentPdaAddress = await Document.findPdaAddress(documentIndex, receiverWalletAddress, this.programId);

    // Send transaction
    const instructionData = new InstructionData(DocumentsInstruction.SendDocument, {data: documentData}).encode();
    const instruction = new TransactionInstruction({
      keys: [
        {pubkey: this.payer.publicKey, isSigner: true, isWritable: true},
        {pubkey: receiverPdaAddress, isSigner: false, isWritable: true},
        {pubkey: documentPdaAddress, isSigner: false, isWritable: true},
        {pubkey: receiverWalletAddress, isSigner: false, isWritable: false},
        {pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false},
        {pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false},
        {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
      ],
      programId: this.programId,
      data: new Instruction({
        instruction: DocumentsInstruction.SendDocument,
        [DocumentsInstruction.SendDocument]: new Uint8Array(instructionData),
      }).encode(),
    });

    const txSignature = await sendAndConfirmTransaction(
      this.connection,
      new Transaction().add(instruction),
      [this.payer],
    );

    return txSignature;
  }

  public async getDocuments(receiverWalletAddress: PublicKey): Promise<Array<SolDocument>> {
    console.log('Retrieve documents for', receiverWalletAddress.toBase58());

    // Get receiver PDA account address
    const receiverPdaAddress = await Receiver.findPdaAddress(receiverWalletAddress, this.programId);

    // Get number of documents
    const documentsCounter = await this.getDocumentsCounter(receiverPdaAddress);

    console.log('-> Documents count:', documentsCounter);

    const documents: Array<SolDocument> = [];

    // Get documents
    for (let i = 0; i < documentsCounter; i++) {
      const documentPdaAddress = await Document.findPdaAddress(i, receiverWalletAddress, this.programId);
      const document = await this.getDocument(documentPdaAddress);
      document.index = i;
      documents.push(document);
    }

    return documents;
  }

  private async getDocument(documentPdaAddress: PublicKey) {
    const accountInfo = await this.connection.getAccountInfo(documentPdaAddress);

    if (accountInfo === null) {
      throw Error('Cannot find the document account');
    }

    const document = Document.decode<Document>(Document.schema, Document, accountInfo.data);

    if (!document) {
      throw Error('Problem with document data');
    }

    const {sender, data, sent_at, opened_at} = document;

    // TODO: make better deserialization...
    return {
      index: 0,
      sender: new PublicKey(Buffer.from(sender ?? '')).toBase58(),
      data: Buffer.from(data ?? '').toString(),
      sent_at: new BN(sent_at ?? 0).toString(),
      opened_at: new BN(opened_at ?? 0).toString(),
    }
  }

  private async createReceiverPdaAccount(receiverWalletAddress: PublicKey): Promise<PublicKey> {
    // Get receiver PDA account address
    const receiverPdaAddress = await Receiver.findPdaAddress(receiverWalletAddress, this.programId);

    // Return account address if already exist
    const isAccountExists = (await this.connection.getAccountInfo(receiverPdaAddress)) !== null;
    if (isAccountExists) {
      return receiverPdaAddress;
    }

    // Send transaction
    const instructionData = new InstructionData(DocumentsInstruction.CreateReceiverAccount, {}).encode();
    const instruction = new TransactionInstruction({
      keys: [
        {pubkey: this.payer.publicKey, isSigner: true, isWritable: true},
        {pubkey: receiverPdaAddress, isSigner: false, isWritable: true},
        {pubkey: receiverWalletAddress, isSigner: false, isWritable: false},
        {pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false},
        {pubkey: SystemProgram.programId, isSigner: false, isWritable: false},
      ],
      programId: this.programId,
      data: new Instruction({
        instruction: DocumentsInstruction.CreateReceiverAccount,
        [DocumentsInstruction.CreateReceiverAccount]: new Uint8Array(instructionData),
      }).encode(),
    });

    await sendAndConfirmTransaction(
      this.connection,
      new Transaction().add(instruction),
      [this.payer],
    );

    return receiverPdaAddress;
  }

  private async getDocumentsCounter(receiverPdaAddress: PublicKey): Promise<number> {
    const accountInfo = await this.connection.getAccountInfo(receiverPdaAddress);

    if (accountInfo === null) {
      throw Error('Cannot find the receiver account');
    }

    return Receiver.decode<Receiver>(Receiver.schema, Receiver, accountInfo.data)
      .documents_counter;
  }
}

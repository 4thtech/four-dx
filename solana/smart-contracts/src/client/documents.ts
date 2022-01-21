import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  sendAndConfirmTransaction,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_RENT_PUBKEY,
  Transaction,
  TransactionInstruction,
} from '@solana/web3.js';
import fs from 'mz/fs';
import path from 'path';

import {createKeypairFromFile, getPayer, getRpcUrl} from './utils';
import {Receiver} from './documents/state';
import {Service} from './documents/Service';

/**
 * Connection to the network
 */
let connection: Connection;

/**
 * Keypair associated to the fees' payer
 */
let payer: Keypair;

/**
 * Documents program id
 */
let programId: PublicKey;

/**
 * The public key of the account we are sending documents to
 */
let receiverPubkey: PublicKey;

/**
 * Path to program files
 */
const PROGRAM_PATH = path.resolve(__dirname, '../../dist/program');

/**
 * Path to program shared object file which should be deployed on chain.
 * This file is created when running:
 *   - `npm run build:program`
 */
const PROGRAM_SO_PATH = path.join(PROGRAM_PATH, 'documents.so');

/**
 * Path to the keypair of the deployed program.
 * This file is created when running `solana program deploy dist/program/documents.so`
 */
const PROGRAM_KEYPAIR_PATH = path.join(PROGRAM_PATH, 'documents-keypair.json');

/**
 * The expected size of each receiver account.
 */
const RECEIVER_SIZE = new Receiver().encode().length;

/**
 * Establish a connection to the cluster
 */
export async function establishConnection(): Promise<void> {
  const rpcUrl = await getRpcUrl();
  connection = new Connection(rpcUrl, 'confirmed');
  const version = await connection.getVersion();
  console.log('Connection to cluster established:', rpcUrl, version);
}

/**
 * Establish an account to pay for everything
 */
export async function establishPayer(): Promise<void> {
  let fees = 0;
  if (!payer) {
    const {feeCalculator} = await connection.getRecentBlockhash();

    // Calculate the cost to fund the receiver account
    fees += await connection.getMinimumBalanceForRentExemption(RECEIVER_SIZE);

    // Calculate the cost of sending transactions
    fees += feeCalculator.lamportsPerSignature * 100; // wag

    payer = await getPayer();
  }

  let lamports = await connection.getBalance(payer.publicKey);
  if (lamports < fees) {
    // If current balance is not enough to pay for fees, request an airdrop
    const sig = await connection.requestAirdrop(
      payer.publicKey,
      fees - lamports,
    );
    await connection.confirmTransaction(sig);
    lamports = await connection.getBalance(payer.publicKey);
  }

  console.log(
    'Using account',
    payer.publicKey.toBase58(),
    'containing',
    lamports / LAMPORTS_PER_SOL,
    'SOL to pay for fees',
  );
}

/**
 * Check if the documents BPF program has been deployed
 */
export async function checkProgram(): Promise<void> {
  // Read program id from keypair file
  try {
    const programKeypair = await createKeypairFromFile(PROGRAM_KEYPAIR_PATH);
    programId = programKeypair.publicKey;
  } catch (err) {
    const errMsg = (err as Error).message;
    throw new Error(
      `Failed to read program keypair at '${PROGRAM_KEYPAIR_PATH}' due to error: ${errMsg}. Program may need to be deployed with \`solana program deploy dist/program/documents.so\``,
    );
  }

  // Check if the program has been deployed
  const programInfo = await connection.getAccountInfo(programId);
  if (programInfo === null) {
    if (fs.existsSync(PROGRAM_SO_PATH)) {
      throw new Error(
        'Program needs to be deployed with `solana program deploy dist/program/documents.so`',
      );
    } else {
      throw new Error('Program needs to be built and deployed');
    }
  } else if (!programInfo.executable) {
    throw new Error(`Program is not executable`);
  }
  console.log(`Using program ${programId.toBase58()}`);

  // Derive the address (public key) of a receiver account from the program so that it's easy to find later.
  const RECEIVER_SEED = 'receiver';
  receiverPubkey = await PublicKey.createWithSeed(
    payer.publicKey,
    RECEIVER_SEED,
    programId,
  );

  // Check if the receiver account has already been created
  const receiverAccount = await connection.getAccountInfo(receiverPubkey);

  if (receiverAccount === null) {
    console.log(
      'Creating account',
      receiverPubkey.toBase58(),
      'to send documents to',
    );
    const lamports = await connection.getMinimumBalanceForRentExemption(
      RECEIVER_SIZE,
    );

    const transaction = new Transaction().add(
      SystemProgram.createAccountWithSeed({
        fromPubkey: payer.publicKey,
        basePubkey: payer.publicKey,
        seed: RECEIVER_SEED,
        newAccountPubkey: receiverPubkey,
        lamports,
        space: RECEIVER_SIZE,
        programId,
      }),
    );
    await sendAndConfirmTransaction(connection, transaction, [payer]);
  }
}

//==============================================================================

/**
 * Send document
 */
export async function sendDocument(): Promise<void> {
  const receiverWalletAddress = new PublicKey('93Yp51XzFHfaPY7aJUFg5tmeijLmg3Ai9nGhnaiUPgiK');

  const documentData = '0x18747470733a2f2f656d6e3137382e6769746875622e696f2f6f6e6c696e652d746f6f6c732f7368613235362e68746d6ce2c1fcbd5b4befacb2ebdc5a7b6e6da86ad5b2a1ebb50371a546d197467165c9';
  const documentData2 = '0x28747470733a2f2f656d6e3137382e6769746875622e696f2f6f6e6c696e652d746f6f6c732f7368613235362e68746d6ce2c1fcbd5b4befacb2ebdc5a7b6e6da86ad5b2a1ebb50371a546d197467165c9';

  // Init service
  const service = new Service(connection, programId, payer);

  // Send documents
  const txSignature = await service.sendDocument(receiverWalletAddress, Buffer.from(documentData));
  const txSignature2 = await service.sendDocument(receiverWalletAddress, Buffer.from(documentData2));

  console.log(txSignature);
}

/**
 * Read documents
 */
export async function readDocuments(): Promise<void> {
  const receiverWalletAddress = new PublicKey('93Yp51XzFHfaPY7aJUFg5tmeijLmg3Ai9nGhnaiUPgiK');

  // Init service
  const service = new Service(connection, programId, payer);

  // Get documents
  const documents = await service.getDocuments(receiverWalletAddress);

  console.log(documents);
}

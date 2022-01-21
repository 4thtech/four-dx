/**
 * Documents
 */

import {
  establishConnection,
  establishPayer,
  checkProgram,
  sendDocument,
  readDocuments,
} from './documents';

async function main() {
  console.log("Let's send some documents to a Solana account...");

  // Establish connection to the cluster
  await establishConnection();

  // Determine who pays for the fees
  await establishPayer();

  // Check if the program has been deployed
  await checkProgram();

  // Send document to an account
  await sendDocument();

  // Read documents from an account
  await readDocuments();

  console.log('Success');
}

main().then(
  () => process.exit(),
  err => {
    console.error(err);
    process.exit(-1);
  },
);

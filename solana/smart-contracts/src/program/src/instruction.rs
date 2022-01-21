use {
    borsh::{BorshDeserialize, BorshSerialize},
    solana_program::{
        instruction::{
            AccountMeta,
            Instruction,
        },
        pubkey::Pubkey,
        system_program,
        sysvar,
    },
    crate::{
        id,
        state::Receiver,
    },
};
use crate::state::Document;

#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub enum DocumentsInstruction {
    /// Create a new receiver account
    ///
    /// Accounts expected:
    ///
    /// 0. `[signer]` Sender account/Funder account (must be a system account)
    /// 1. `[]` PDA address of the receiver of the document
    /// 2. `[]` Wallet address of the document receiver
    /// 3. `[]` Rent sysvar
    /// 4. `[]` System program
    CreateReceiverAccount,

    /// Create a new document account
    ///
    /// Accounts expected:
    ///
    /// 0. `[signer]` Sender account/Funding account (must be a system account)
    /// 1. `[writable]` PDA address of the receiver of the document
    /// 2. `[writable]` PDA address of the document
    /// 3. `[]` Wallet address of the document receiver
    /// 4. `[]` Rent sysvar
    /// 5. `[]` Clock sysvar
    /// 6. `[]` System program
    SendDocument {
        /// Link of the meta file and checksum
        data: Vec<u8>,
    },
}

/// Creates CreateReceiverAccount instruction
pub fn create_receiver_account(
    funder_address: &Pubkey,
    wallet_address: &Pubkey,
) -> Instruction {
    let receiver_pda_address = Receiver::find_pda_address(
        &wallet_address,
        &id(),
    );

    Instruction::new_with_borsh(
        id(),
        &DocumentsInstruction::CreateReceiverAccount {},
        vec![
            AccountMeta::new(*funder_address, true),
            AccountMeta::new(receiver_pda_address, false),
            AccountMeta::new(*wallet_address, false),
            AccountMeta::new_readonly(sysvar::rent::id(), false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
    )
}

/// Creates SendDocument instruction
pub fn send_document(
    funder_address: &Pubkey,
    wallet_address: &Pubkey,
    document_index: u32,
    document_data: Vec<u8>,
) -> Instruction {
    let receiver_pda_address = Receiver::find_pda_address(
        &wallet_address,
        &id(),
    );

    let document_pda_address = Document::find_pda_address(
        document_index,
        &wallet_address,
        &id(),
    );

    Instruction::new_with_borsh(
        id(),
        &DocumentsInstruction::SendDocument {
            data: document_data,
        },
        vec![
            AccountMeta::new(*funder_address, true),
            AccountMeta::new(receiver_pda_address, false),
            AccountMeta::new(document_pda_address, false),
            AccountMeta::new(*wallet_address, false),
            AccountMeta::new_readonly(sysvar::rent::id(), false),
            AccountMeta::new_readonly(sysvar::clock::id(), false),
            AccountMeta::new_readonly(system_program::id(), false),
        ],
    )
}
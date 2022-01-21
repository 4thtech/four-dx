//! Program state processor

use {
    crate::{
        instruction::DocumentsInstruction,
        state::{Document, Receiver},
        utils::create_pda_account,
    },
    borsh::{BorshDeserialize, BorshSerialize},
    solana_program::{
        account_info::{next_account_info, AccountInfo},
        clock::Clock,
        entrypoint::ProgramResult,
        msg,
        program_error::ProgramError,
        pubkey::Pubkey,
        rent::Rent,
        sysvar::{
            clock,
            rent,
            Sysvar,
        },
    },
};

pub fn process_instruction(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    instruction_data: &[u8],
) -> ProgramResult {
    let instruction = DocumentsInstruction::try_from_slice(instruction_data)?;

    match instruction {
        DocumentsInstruction::CreateReceiverAccount {} => create_receiver_account(program_id, accounts),
        DocumentsInstruction::SendDocument { data } => send_document(program_id, accounts, data),
    }
}

fn create_receiver_account(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();

    let funder_info = next_account_info(account_info_iter)?;
    let receiver_account_info = next_account_info(account_info_iter)?;
    let receiver_wallet_account_info = next_account_info(account_info_iter)?;
    let rent_info = next_account_info(account_info_iter)?;
    let system_program_info = next_account_info(account_info_iter)?;

    let rent = &Rent::from_account_info(rent_info)?;

    let (receiver_address, receiver_bump_seed) =
        Receiver::find_pda_address_with_bump_seed(
            receiver_wallet_account_info.key,
            program_id,
        );

    if receiver_address != *receiver_account_info.key {
        msg!("Error: Receiver address does not match seed derivation");
        return Err(ProgramError::InvalidSeeds);
    }

    if receiver_account_info.data.borrow().len() > 0 {
        msg!("Error: Receiver account is already initialized");
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    let receiver_account_signer_seeds: &[&[_]] = &[
        &receiver_wallet_account_info.key.to_bytes(),
        &Receiver::ACCOUNT_ADDRESS_SEED.as_bytes(),
        &[receiver_bump_seed],
    ];

    create_pda_account(
        funder_info,
        &rent,
        Receiver::retrieve_size(),
        program_id,
        system_program_info,
        receiver_account_info,
        receiver_account_signer_seeds,
    )?;

    Ok(())
}

fn send_document(
    program_id: &Pubkey,
    accounts: &[AccountInfo],
    data: Vec<u8>,
) -> ProgramResult {
    let account_info_iter = &mut accounts.iter();

    let sender_info = next_account_info(account_info_iter)?;
    let receiver_account_info = next_account_info(account_info_iter)?;
    let document_account_info = next_account_info(account_info_iter)?;
    let receiver_wallet_account_info = next_account_info(account_info_iter)?;
    let rent_info = next_account_info(account_info_iter)?;
    let clock_info = next_account_info(account_info_iter)?;
    let system_program_info = next_account_info(account_info_iter)?;

    let rent = &Rent::from_account_info(rent_info)?;

    let receiver_address = Receiver::find_pda_address(
        receiver_wallet_account_info.key,
        program_id,
    );

    if receiver_address != *receiver_account_info.key {
        msg!("Error: Receiver address does not match seed derivation");
        return Err(ProgramError::InvalidSeeds);
    }

    if receiver_account_info.data.borrow().len() == 0 {
        msg!("Error: Receiver account is not initialized");
        return Err(ProgramError::UninitializedAccount);
    }

    if document_account_info.data.borrow().len() > 0 {
        msg!("Error: Document account is already initialized");
        return Err(ProgramError::AccountAlreadyInitialized);
    }

    if !sender_info.is_signer {
        msg!("Error: Sender signature missing");
        return Err(ProgramError::MissingRequiredSignature);
    }

    if receiver_account_info.owner != program_id {
        msg!("Error: Receiver account does not have the correct program id");
        return Err(ProgramError::IncorrectProgramId);
    }

    let mut receiver: Receiver = Receiver::try_from_slice(&receiver_account_info.data.borrow())?;
    let documents_counter = receiver.documents_counter;

    let (document_address, document_bump_seed) = Document::find_pda_address_with_bump_seed(
        documents_counter,
        receiver_wallet_account_info.key,
        program_id,
    );

    if document_address != *document_account_info.key {
        msg!("Error: Document address does not match seed derivation");
        return Err(ProgramError::InvalidSeeds);
    }

    if !rent.is_exempt(
        receiver_account_info.lamports(),
        receiver_account_info.data_len(),
    ) {
        msg!("Error: Receiver account is not rent exempt");
        return Err(ProgramError::AccountNotRentExempt);
    }

    if !rent::check_id(rent_info.key) {
        msg!("Error: Invalid rent system account");
        return Err(ProgramError::InvalidAccountData);
    }

    if !clock::check_id(clock_info.key) {
        msg!("Error: Invalid clock system account");
        return Err(ProgramError::InvalidAccountData);
    }

    // Create document PDA account
    let account_seed = documents_counter.to_string() + Document::ACCOUNT_ADDRESS_SEED;

    let document_account_signer_seeds: &[&[_]] = &[
        &receiver_wallet_account_info.key.to_bytes(),
        &account_seed.as_bytes(),
        &[document_bump_seed],
    ];

    create_pda_account(
        sender_info,
        &rent,
        Document::retrieve_size(data.len()),
        program_id,
        system_program_info,
        document_account_info,
        document_account_signer_seeds,
    )?;

    // Store document data
    let mut document = Document::new(data.len());
    document.sender = *sender_info.key;
    document.data = data;
    document.sent_at = Clock::from_account_info(clock_info)?.unix_timestamp;
    document.serialize(&mut &mut document_account_info.data.borrow_mut()[..])?;

    // Increment and store the number of documents the receiver account has
    receiver.documents_counter += 1;
    receiver.serialize(&mut &mut receiver_account_info.data.borrow_mut()[..])?;

    Ok(())
}

// Mark this test as BPF-only due to current `ProgramTest` limitations when CPIing into the system program
#![cfg(feature = "test-bpf")]

mod program_test;

use {
    borsh::{BorshDeserialize},
    documents::{
        id,
        instruction::{
            create_receiver_account,
            send_document,
        },
        state::{Document, Receiver},
    },
    solana_program::{
        pubkey::Pubkey,
        sysvar,
    },
    solana_program_test::*,
    solana_sdk::{
        signature::{
            Signer,
        },
        transaction::Transaction,
    },
    program_test::program_test,
};

#[tokio::test]
async fn test_create_receiver_account() {
    let receiver_wallet_address = Pubkey::new_unique();
    let receiver_pda_address = Receiver::find_pda_address(
        &receiver_wallet_address,
        &id(),
    );

    let (mut banks_client, payer, recent_blockhash) =
        program_test().start().await;

    // Receiver PDA account does not exist
    assert_eq!(
        banks_client
            .get_account(receiver_pda_address)
            .await
            .expect("get_account"),
        None,
    );

    // Create Receiver PDA account
    let transaction = Transaction::new_signed_with_payer(
        &[create_receiver_account(
            &payer.pubkey(),
            &receiver_wallet_address,
        )],
        Some(&payer.pubkey()),
        &[&payer],
        recent_blockhash,
    );

    banks_client
        .process_transaction(transaction)
        .await
        .unwrap();

    // Receiver PDA account now exist
    let receiver_pda_account = banks_client
        .get_account(receiver_pda_address)
        .await
        .expect("get_account")
        .expect("receiver_pda_account not found");

    assert_eq!(
        receiver_pda_account.data.len(),
        Receiver::retrieve_size(),
    );

    assert_eq!(
        Receiver::try_from_slice(&receiver_pda_account.data)
            .unwrap()
            .documents_counter,
        0,
    );

    let is_rent_exempt = sysvar::rent::Rent::default()
        .is_exempt(receiver_pda_account.lamports, receiver_pda_account.data.len());

    assert_eq!(is_rent_exempt, true);
}

#[tokio::test]
async fn test_send_document() {
    let receiver_wallet_address = Pubkey::new_unique();
    let receiver_pda_address = Receiver::find_pda_address(
        &receiver_wallet_address,
        &id(),
    );

    let (mut banks_client, payer, recent_blockhash) =
        program_test().start().await;

    // Create Receiver PDA account
    let transaction = Transaction::new_signed_with_payer(
        &[create_receiver_account(
            &payer.pubkey(),
            &receiver_wallet_address,
        )],
        Some(&payer.pubkey()),
        &[&payer],
        recent_blockhash,
    );

    banks_client
        .process_transaction(transaction)
        .await
        .unwrap();

    // Get dummy documents data
    let documents_data = get_documents_dummy_data();

    // Send transactions for every document
    for (i, document_data) in documents_data.iter().enumerate() {
        let transaction = Transaction::new_signed_with_payer(
            &[send_document(
                &payer.pubkey(),
                &receiver_wallet_address,
                i as u32,
                document_data.clone(),
            )],
            Some(&payer.pubkey()),
            &[&payer],
            recent_blockhash,
        );

        banks_client
            .process_transaction(transaction)
            .await
            .unwrap();
    }

    // Validate documents account data
    for (i, document_data) in documents_data.iter().enumerate() {
        let document_pda_address = Document::find_pda_address(
            i as u32,
            &receiver_wallet_address,
            &id(),
        );

        let document_pda_account = banks_client
            .get_account(document_pda_address)
            .await
            .expect("get_account")
            .expect("document_pda_account not found");

        let document: Document = Document::try_from_slice(&document_pda_account.data)
            .unwrap();

        assert_eq!(document.sender, payer.pubkey());
        assert_eq!(document.data, document_data.clone());
        assert_ne!(document.sent_at, 0);
        assert_eq!(document.opened_at, 0);

        let is_rent_exempt = sysvar::rent::Rent::default()
            .is_exempt(document_pda_account.lamports, document_pda_account.data.len());

        assert_eq!(is_rent_exempt, true);
    }

    // Receiver PDA account should have 2 documents
    let receiver_pda_account = banks_client
        .get_account(receiver_pda_address)
        .await
        .expect("get_account")
        .expect("receiver_pda_account not found");

    assert_eq!(
        Receiver::try_from_slice(&receiver_pda_account.data)
            .unwrap()
            .documents_counter,
        2,
    );
}

fn get_documents_dummy_data() -> Vec<Vec<u8>> {
    let documents_data = vec![
        String::from("0x18747470733a2f2f656d6e3137382e6769746875622e696f2f6f6e6c696e652d746f6f6c732f7368613235362e68746d6ce2c1fcbd5b4befacb2ebdc5a7b6e6da86ad5b2a1ebb50371a546d197467165c9")
            .into_bytes(),
        String::from("0x28747470733a2f2f656d6e3137382e6769746875622e696f2f6f6e6c696e652d746f6f6c732f7368613235362e68746d6ce2c1fcbd5b4befacb2ebdc5a7b6e6da86ad5b2a1ebb50371a546d19746")
            .into_bytes(),
    ];

    documents_data
}

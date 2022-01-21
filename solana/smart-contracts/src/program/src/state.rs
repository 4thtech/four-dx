use {
    borsh::{BorshDeserialize, BorshSerialize},
    solana_program::{
        clock::UnixTimestamp,
        pubkey::{
            Pubkey,
        },
    },
    std::mem,
};

/// Define a receiver account structure
#[derive(BorshSerialize, BorshDeserialize, Debug)]
pub struct Receiver {
    /// Number of documents
    pub documents_counter: u32,
}

impl Receiver {
    pub const ACCOUNT_ADDRESS_SEED: &'static str = "receiver";

    /// Create a new dummy receiver account
    pub fn new() -> Self {
        Self {
            documents_counter: 0,
        }
    }

    /// Get size of receiver account
    pub fn retrieve_size() -> usize {
        mem::size_of::<Receiver>()
    }

    /// Get program-derived account address and bump seeds for the receiver
    pub fn find_pda_address_with_bump_seed(
        receiver_address: &Pubkey,
        program_id: &Pubkey,
    ) -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[
                &receiver_address.to_bytes(),
                Receiver::ACCOUNT_ADDRESS_SEED.as_bytes(),
            ],
            program_id,
        )
    }

    /// Get program-derived account address for the receiver
    pub fn find_pda_address(
        receiver_address: &Pubkey,
        program_id: &Pubkey,
    ) -> Pubkey {
        Self::find_pda_address_with_bump_seed(receiver_address, program_id).0
    }
}

/// Define a document account structure
#[derive(BorshSerialize, BorshDeserialize, Debug, PartialEq)]
pub struct Document {
    /// The sender of a document
    pub sender: Pubkey,
    /// Data about an off-chain document
    pub data: Vec<u8>,
    /// Timestamp at which the document was sent/received
    pub sent_at: UnixTimestamp,
    /// Timestamp at which the document was opened
    pub opened_at: UnixTimestamp,
}

impl Document {
    pub const ACCOUNT_ADDRESS_SEED: &'static str = "document";

    /// Create a new dummy document account
    pub fn new(data_size: usize) -> Self {
        Self {
            sender: Pubkey::default(),
            data: vec![0_u8; data_size],
            sent_at: UnixTimestamp::default(),
            opened_at: UnixTimestamp::default(),
        }
    }

    /// Get size of document account
    pub fn retrieve_size(data_size: usize) -> usize {
        Self::new(data_size).try_to_vec().unwrap().len()
    }

    /// Get PDA address for the document of the receiver and bump seeds
    pub fn find_pda_address_with_bump_seed(
        document_index: u32,
        receiver_address: &Pubkey,
        program_id: &Pubkey,
    ) -> (Pubkey, u8) {
        Pubkey::find_program_address(
            &[
                &receiver_address.to_bytes(),
                (document_index.to_string() + Document::ACCOUNT_ADDRESS_SEED).as_bytes(),
            ],
            program_id,
        )
    }

    /// Get PDA address for the document of the receiver
    pub fn find_pda_address(
        document_index: u32,
        receiver_address: &Pubkey,
        program_id: &Pubkey,
    ) -> Pubkey {
        Self::find_pda_address_with_bump_seed(document_index, receiver_address, program_id).0
    }
}

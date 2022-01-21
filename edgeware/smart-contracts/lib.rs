#![cfg_attr(not(feature = "std"), no_std)]

use ink_lang as ink;

#[ink::contract]
mod documents {
    use ink_prelude::vec::Vec;
    use ink_storage::collections::HashMap;
    use ink_storage::traits::{PackedLayout, SpreadLayout};

    #[derive(Clone, Debug, scale::Encode, scale::Decode, SpreadLayout, PackedLayout)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub struct Document {
        sender: AccountId,
        data: Vec<u8>,
        sent_at: Timestamp,
        opened_at: Timestamp,
    }

    #[derive(Clone, Copy, Debug, scale::Encode, scale::Decode, Eq, PartialEq)]
    #[cfg_attr(feature = "std", derive(scale_info::TypeInfo))]
    pub enum Error {
        /// This can change only receiver of the document.
        NotAllowed,
        /// The document does not exist.
        NotExist,
        /// The document was already opened.
        AlreadyOpened,
    }

    #[ink(storage)]
    pub struct Documents {
        documents: HashMap<AccountId, Vec<Document>>,
    }

    #[ink(event)]
    pub struct AddDocument {
        #[ink(topic)]
        sender: AccountId,
        #[ink(topic)]
        receiver: AccountId,
        data: Vec<u8>,
        sent_at: Timestamp,
    }

    #[ink(event)]
    pub struct SetOpenedAt {
        #[ink(topic)]
        receiver: AccountId,
        index: u32,
        opened_at: Timestamp,
    }

    impl Documents {
        #[ink(constructor)]
        pub fn new() -> Self {
            Self {
                documents: HashMap::new(),
            }
        }

        #[ink(message)]
        pub fn add_document(&mut self, receiver: AccountId, data: Vec<u8>) -> bool {
            if !self.documents.contains_key(&receiver) {
                self.documents.insert(receiver, Vec::new());
            }

            let sender = self.env().caller();
            let sent_at = self.env().block_timestamp();

            self.documents.get_mut(&receiver).unwrap().push(Document {
                sender,
                data: data.clone(),
                sent_at,
                opened_at: Timestamp::default(),
            });

            self.env().emit_event(AddDocument {
                sender,
                receiver,
                data,
                sent_at,
            });

            true
        }

        #[ink(message)]
        pub fn set_opened_at(&mut self, receiver: AccountId, index: u32) -> Result<(), Error> {
            let caller = self.env().caller();
            let sent_at = self.env().block_timestamp();

            if receiver != caller {
                return Err(Error::NotAllowed);
            }

            if index >= self.get_documents_count(receiver) {
                return Err(Error::NotExist);
            }

            let doc = self.documents.get_mut(&receiver)
                .ok_or(Error::NotExist)
                .unwrap()
                .get_mut(index as usize)
                .ok_or(Error::NotExist)
                .unwrap();

            doc.opened_at = sent_at;

            self.env().emit_event(SetOpenedAt {
                receiver,
                index,
                opened_at: sent_at,
            });

            Ok(())
        }

        #[ink(message)]
        pub fn get_documents(&self, receiver: AccountId) -> Option<Vec<Document>> {
            let docs = self.documents.get(&receiver)?;
            Some(docs.clone())
        }

        #[ink(message)]
        pub fn get_document(&self, receiver: AccountId, index: u32) -> Option<Document> {
            let doc = self.documents.get(&receiver)?.get(index as usize)?;
            Some(doc.clone())
        }

        #[ink(message)]
        pub fn get_documents_count(&self, receiver: AccountId) -> u32 {
            self.documents.get(&receiver).unwrap_or(&Vec::new()).len() as u32
        }
    }

    #[cfg(test)]
    mod tests {
        use ink_lang as ink;

        use super::*;

        fn default_accounts() -> ink_env::test::DefaultAccounts<ink_env::DefaultEnvironment> {
            ink_env::test::default_accounts::<ink_env::DefaultEnvironment>()
                .expect("off-chain environment should have been initialized already")
        }

        fn add_document(contract: &mut Documents, receiver: AccountId) -> bool {
            contract.add_document(
                receiver,
                String::from("0x18747470733a2f2f656d6e3137382e6769746875622e696f2f6f6e6c696e652d746f6f6c732f7368613235362e68746d6ce2c1fcbd5b4befacb2ebdc5a7b6e6da86ad5b2a1ebb50371a546d197467165c9").into_bytes(),
            )
        }

        #[ink::test]
        fn adding_documents_works() {
            let mut contract = Documents::new();
            let default_accounts = default_accounts();

            assert_eq!(contract.get_documents_count(default_accounts.alice), 0);
            assert_eq!(add_document(&mut contract, default_accounts.alice), true);
            assert_eq!(ink_env::test::recorded_events().count(), 1);
            assert_eq!(add_document(&mut contract, default_accounts.alice), true);
            assert_eq!(add_document(&mut contract, default_accounts.bob), true);
            assert_eq!(contract.get_documents_count(default_accounts.alice), 2);
            assert_eq!(contract.get_documents_count(default_accounts.bob), 1);
        }

        #[ink::test]
        fn retrieving_documents_works() {
            let mut contract = Documents::new();
            let default_accounts = default_accounts();

            assert_eq!(contract.get_documents(default_accounts.alice).is_none(), true);
            add_document(&mut contract, default_accounts.alice);
            add_document(&mut contract, default_accounts.alice);
            assert_eq!(contract.get_documents(default_accounts.alice).is_some(), true);
            assert_eq!(contract.get_documents(default_accounts.alice).unwrap().len(), 2);
        }

        #[ink::test]
        fn retrieving_document_works() {
            let mut contract = Documents::new();
            let default_accounts = default_accounts();

            assert_eq!(contract.get_document(default_accounts.alice, 0).is_none(), true);
            assert_eq!(contract.get_document(default_accounts.alice, 1).is_none(), true);
            add_document(&mut contract, default_accounts.alice);
            add_document(&mut contract, default_accounts.alice);
            assert_eq!(contract.get_document(default_accounts.alice, 0).is_some(), true);
        }

        #[ink::test]
        fn setting_opened_at_works() {
            let mut contract = Documents::new();
            let default_accounts = default_accounts();

            assert_eq!(contract.set_opened_at(default_accounts.bob, 0), Err(Error::NotAllowed));
            assert_eq!(contract.set_opened_at(default_accounts.alice, 0), Err(Error::NotExist));
            add_document(&mut contract, default_accounts.alice);
            assert_eq!(contract.set_opened_at(default_accounts.alice, 0), Ok(()));
            assert_eq!(ink_env::test::recorded_events().count(), 2);
        }
    }
}

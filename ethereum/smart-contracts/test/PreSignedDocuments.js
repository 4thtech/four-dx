const { expect } = require('chai');

// Prepare documents data
const DATA_1 = '0x68747470733a2f2f656d6e3137382e6769746875622e696f2f6f6e6c696e652d746f6f6c732f7368613235362e68746d6ce2c1fcbd5b4befacb2ebdc5a7b6e6da86ad5b2a1ebb50371a546d197467165c9';

describe('PreSignedDocuments', async () => {
    let sender;
    let senderAddress;
    let receiver;
    let receiverAddress;
    let nonce = Date.now();
    let documents;

    before(async () => {
        // Prepare accounts
        const accounts = await ethers.getSigners();
        sender = await accounts[1];
        senderAddress = await sender.getAddress();
        receiver = await accounts[2];
        receiverAddress = await receiver.getAddress();
    });

    beforeEach(async () => {
        const PreSignedDocuments = await ethers.getContractFactory('PreSignedDocuments');
        documents = await PreSignedDocuments.deploy();

        await documents.deployed();
    });

    describe('isValidSignature', () => {
        it('should generate valid signature for calculatePreSignedDocumentHash', async () => {
            // Calculate hash of the tx
            let hash = await documents.calculatePreSignedDocumentHash(senderAddress, receiverAddress, DATA_1, nonce);

            // Sign transaction hash with senders account
            const signature = await sender.signMessage(ethers.utils.arrayify(hash));

            // Split signature
            const sig = ethers.utils.splitSignature(signature);

            // Check if it's valid signature
            expect(await documents.isValidSignature(senderAddress, hash, sig.v, sig.r, sig.s))
                .to.be.equal(true);
        });

        it('should generate valid signature for calculateHash', async () => {
            const index = 0;

            // Calculate hash of the tx
            const hash = await documents.calculateHash(receiverAddress, index, nonce);

            // Sign transaction hash with senders account
            const signature = await receiver.signMessage(ethers.utils.arrayify(hash));

            // Split signature
            const sig = ethers.utils.splitSignature(signature);

            // Check if it's valid signature
            expect(await documents.isValidSignature(receiverAddress, hash, sig.v, sig.r, sig.s))
                .to.be.equal(true);
        });
    });

    describe('setPreSignedDocument', async () => {
        it('should allow third party to set pre signed document and check if all the values are valid', async () => {
            // Calculate hash of the tx
            let hash = await documents.calculatePreSignedDocumentHash(senderAddress, receiverAddress, DATA_1, nonce);

            // Sign transaction hash with senders account
            const signature = await sender.signMessage(ethers.utils.arrayify(hash));

            // Split signature
            const sig = ethers.utils.splitSignature(signature);

            await documents.setPreSignedDocument(senderAddress, receiverAddress, DATA_1, nonce, sig.v, sig.r, sig.s);

            const doc = await documents.getDocument(receiverAddress, 0);

            expect(doc[1]).to.equal(DATA_1);
        });

        it('should emit event', async () => {
            // Calculate hash of the tx
            let hash = await documents.calculatePreSignedDocumentHash(senderAddress, receiverAddress, DATA_1, nonce);

            // Sign transaction hash with senders account
            const signature = await sender.signMessage(ethers.utils.arrayify(hash));

            // Split signature
            const sig = ethers.utils.splitSignature(signature);

            await expect(documents.setPreSignedDocument(senderAddress, receiverAddress, DATA_1, nonce, sig.v, sig.r, sig.s))
                .to.emit(documents, 'SetDocument');
        });

        it('should revert if the signature is invalid', async () => {
            // Calculate hash of the tx
            let hash = await documents.calculatePreSignedDocumentHash(senderAddress, receiverAddress, DATA_1, nonce);

            // Sign transaction hash with senders account
            const signature = await receiver.signMessage(ethers.utils.arrayify(hash));

            // Split signature
            const sig = ethers.utils.splitSignature(signature);

            await expect(documents.setPreSignedDocument(senderAddress, receiverAddress, DATA_1, nonce, sig.v, sig.r, sig.s))
                .to.be.revertedWith('Signature is not valid.');
        });

        it('should revert when receive the same parameters multiple times', async () => {
            // Calculate hash of the tx
            let hash = await documents.calculatePreSignedDocumentHash(senderAddress, receiverAddress, DATA_1, nonce);

            // Sign transaction hash with senders account
            const signature = await sender.signMessage(ethers.utils.arrayify(hash));

            // Split signature
            const sig = ethers.utils.splitSignature(signature);

            await documents.setPreSignedDocument(senderAddress, receiverAddress, DATA_1, nonce, sig.v, sig.r, sig.s);

            await expect(documents.setPreSignedDocument(senderAddress, receiverAddress, DATA_1, nonce, sig.v, sig.r, sig.s))
                .to.be.revertedWith('A transaction with the same parameters was already executed.');
        });
    });

    describe('setPreSignedOpenedAt', async () => {
        it('should reject if document for given index and user address not exist', async () => {
            await documents.setDocument(receiverAddress, DATA_1);
            
            // Calculate hash of the tx
            let hash = await documents.calculateHash(receiverAddress, 99, nonce);

            // Sign transaction hash with senders account
            const signature = await receiver.signMessage(ethers.utils.arrayify(hash));

            // Split signature
            const sig = ethers.utils.splitSignature(signature);
            
            await expect(documents.setPreSignedOpenedAt(receiverAddress, 99, nonce, sig.v, sig.r, sig.s))
                .to.be.revertedWith('The document does not exist.');
        });

        it('should set openedAt if document for given index and user address exist', async () => {
            await documents.setDocument(receiverAddress, DATA_1);

            // Calculate hash of the tx
            let hash = await documents.calculateHash(receiverAddress, 0, nonce);

            // Sign transaction hash with senders account
            const signature = await receiver.signMessage(ethers.utils.arrayify(hash));

            // Split signature
            const sig = ethers.utils.splitSignature(signature);

            await documents.setPreSignedOpenedAt(receiverAddress, 0, nonce, sig.v, sig.r, sig.s);

            const doc = await documents.getDocument(receiverAddress, 0);

            expect(doc[3]).to.not.be.equal(0);
        });

        it('should fail if we want to set openedAt more than once', async () => {
            await documents.setDocument(receiverAddress, DATA_1);

            /*** Set 1. time ***/
            // Calculate hash of the tx
            let hash = await documents.calculateHash(receiverAddress, 0, nonce);

            // Sign transaction hash with senders account
            let signature = await receiver.signMessage(ethers.utils.arrayify(hash));

            // Split signature
            let sig = ethers.utils.splitSignature(signature);

            await documents.setPreSignedOpenedAt(receiverAddress, 0, nonce, sig.v, sig.r, sig.s);

            /*** Set 2. time ***/
            ethers.provider.send('evm_increaseTime', [1000]);

            nonce = Date.now() + 1;

            // Calculate hash of the tx
            hash = await documents.calculateHash(receiverAddress, 0, nonce);

            // Sign transaction hash with senders account
            signature = await receiver.signMessage(ethers.utils.arrayify(hash));

            // Split signature
            sig = ethers.utils.splitSignature(signature);

            await expect(documents.setPreSignedOpenedAt(receiverAddress, 0, nonce, sig.v, sig.r, sig.s))
                .to.be.revertedWith('The document was already opened.');
        });

        it('should emit event', async () => {
            await documents.setDocument(receiverAddress, DATA_1);

            // Calculate hash of the tx
            let hash = await documents.calculateHash(receiverAddress, 0, nonce);

            // Sign transaction hash with senders account
            const signature = await receiver.signMessage(ethers.utils.arrayify(hash));

            // Split signature
            const sig = ethers.utils.splitSignature(signature);

            await expect(documents.setPreSignedOpenedAt(receiverAddress, 0, nonce, sig.v, sig.r, sig.s))
                .to.emit(documents, 'SetOpenedAt');
        });

        it('should revert if the signature is invalid', async () => {
            // Calculate hash of the tx
            let hash = await documents.calculateHash(receiverAddress, 0, nonce);

            // Sign transaction hash with senders account
            const signature = await sender.signMessage(ethers.utils.arrayify(hash));

            // Split signature
            const sig = ethers.utils.splitSignature(signature);

            await expect(documents.setPreSignedOpenedAt(receiverAddress, 0, nonce, sig.v, sig.r, sig.s))
                .to.be.revertedWith('Signature is not valid.');
        });

        it('should revert when receive the same parameters multiple times', async () => {
            await documents.setDocument(receiverAddress, DATA_1);

            // Calculate hash of the tx
            let hash = await documents.calculateHash(receiverAddress, 0, nonce);

            // Sign transaction hash with senders account
            const signature = await receiver.signMessage(ethers.utils.arrayify(hash));

            // Split signature
            const sig = ethers.utils.splitSignature(signature);

            await documents.setPreSignedOpenedAt(receiverAddress, 0, nonce, sig.v, sig.r, sig.s);

            ethers.provider.send('evm_increaseTime', [1000]);

            await expect(documents.setPreSignedOpenedAt(receiverAddress, 0, nonce, sig.v, sig.r, sig.s))
                .to.be.revertedWith('A transaction with the same parameters was already executed.');
        });
    });
});

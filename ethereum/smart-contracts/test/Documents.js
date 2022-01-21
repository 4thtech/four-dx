const { expect } = require('chai');

// Prepare documents data
const DATA_1 = '0x68747470733a2f2f656d6e3137382e6769746875622e696f2f6f6e6c696e652d746f6f6c732f7368613235362e68746d6ce2c1fcbd5b4befacb2ebdc5a7b6e6da86ad5b2a1ebb50371a546d197467165c9';
const DATA_2 = '0x78747470733a2f2f656d6e3137382e6769746875622e696f2f6f6e6c696e652d746f6f6c732f7368613235362e68746d6ce2c1fcbd5b4befacb2ebdc5a7b6e6da86ad5b2a1ebb50371a546d197467165c9';
const DATA_3 = '0x88747470733a2f2f656d6e3137382e6769746875622e696f2f6f6e6c696e652d746f6f6c732f7368613235362e68746d6ce2c1fcbd5b4befacb2ebdc5a7b6e6da86ad5b2a1ebb50371a546d197467165c9';
const DATA_4 = '0x98747470733a2f2f656d6e3137382e6769746875622e696f2f6f6e6c696e652d746f6f6c732f7368613235362e68746d6ce2c1fcbd5b4befacb2ebdc5a7b6e6da86ad5b2a1ebb50371a546d197467165c9';

describe('Documents', async () => {
    let account1;
    let account2;
    let account3;
    let account4;
    let documents;

    before(async () => {
        // Prepare accounts
        const accounts = await ethers.getSigners();
        account1 = await accounts[0].getAddress();
        account2 = await accounts[1].getAddress();
        account3 = await accounts[2].getAddress();
        account4 = await accounts[3].getAddress();
    });

    beforeEach(async () => {
        const Documents = await ethers.getContractFactory('Documents');
        documents = await Documents.deploy();

        await documents.deployed();
    });

    describe('setDocument', async () => {
        it('should set document and check if all the values are valid', async () => {
            await documents.setDocument(account1, DATA_1);

            const doc = await documents.getDocument(account1, 0);

            expect(doc[1]).to.equal(DATA_1);
        });

        it('should set multiple documents and check if all the values are valid', async () => {
            await documents.setDocument(account1, DATA_1);
            await documents.setDocument(account1, DATA_2);
            await documents.setDocument(account2, DATA_3);
            await documents.setDocument(account1, DATA_4);

            const doc1 = await documents.getDocument(account1, 0);
            const doc2 = await documents.getDocument(account1, 1);
            const doc3 = await documents.getDocument(account1, 2);
            const doc4 = await documents.getDocument(account2, 0);

            expect(doc1[1]).to.equal(DATA_1);
            expect(doc2[1]).to.equal(DATA_2);
            expect(doc3[1]).to.equal(DATA_4);
            expect(doc4[1]).to.equal(DATA_3);
        });

        it('openedAt should be 0', async () => {
            await documents.setDocument(account1, DATA_1);

            const doc = await documents.getDocument(account1, 0);

            expect(doc[3]).to.equal(0);
        });

        it('should emit event', async () => {
            await expect(documents.setDocument(account1, DATA_1))
                .to.emit(documents, 'SetDocument');
        });
    });

    describe('getDocument', async () => {
        it('should reject if document for given index and user address not exist', async () => {
            await expect(documents.getDocument(account4, 0)).to.be.revertedWith('The document does not exist.');
        });
    });

    describe('getDocumentsCount', async () => {
        it('should return proper documents length based on receiver', async () => {
            expect(await documents.getDocumentsCount(account1)).to.equal(0);

            await documents.setDocument(account1, DATA_1);
            expect(await documents.getDocumentsCount(account1)).to.equal(1);

            await documents.setDocument(account1, DATA_2);
            expect(await documents.getDocumentsCount(account1)).to.equal(2);

            await documents.setDocument(account2, DATA_1);
            expect(await documents.getDocumentsCount(account2)).to.equal(1);

            expect(await documents.getDocumentsCount(account3)).to.equal(0);
        });
    });

    describe('setOpenedAt', async () => {
        it('should reject if document not belong to sender of transaction', async () => {
            await documents.setDocument(account2, DATA_1);

            await expect(documents.setOpenedAt(account2, 0)).to.be.revertedWith('This can change only receiver of the document.');
        });

        it('should reject if document for given index and user address not exist', async () => {
            await expect(documents.setOpenedAt(account1, 0)).to.be.revertedWith('The document does not exist.');
        });

        it('should set openedAt if document for given index and user address exist', async () => {
            await documents.setDocument(account1, DATA_1);
            await documents.setOpenedAt(account1, 0);

            const doc = await documents.getDocument(account1, 0);

            expect(doc[3]).to.not.be.equal(0);
        });

        it('should fail if we want to set openedAt more than once', async () => {
            await documents.setDocument(account1, DATA_1);
            await documents.setOpenedAt(account1, 0);

            ethers.provider.send('evm_increaseTime', [1000]);

            await expect(documents.setOpenedAt(account1, 0)).to.be.revertedWith('The document was already opened.');
        });

        it('should emit event', async () => {
            await documents.setDocument(account1, DATA_1);
            await expect(documents.setOpenedAt(account1, 0))
                .to.emit(documents, 'SetOpenedAt');
        });
    });
});

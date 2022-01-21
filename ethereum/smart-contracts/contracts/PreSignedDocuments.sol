//SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

import "./Documents.sol";

/**
 * @title PreSignedDocuments
 * @author Denis Jazbec
 * @notice You can use this contract for storing documents with pre signed transactions
 * @dev Store documents with pre signed transactions
 */
contract PreSignedDocuments is Documents {
    mapping(address => mapping(bytes32 => bool)) executedSettlements;

    /**
     * @dev Set the document to the recipient with pre signed transaction.
     * @param sender Address of the document sender
     * @param receiver Address of the document receiver
     * @param data Data of the document
     * @param nonce Nonce used for transaction
     * @param v Value we get from signature
     * @param r Value we get from signature
     * @param s Value we get from signature
     */
    function setPreSignedDocument(
        address sender,
        address receiver,
        bytes memory data,
        uint256 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    )
        external
    {
        // Validate sender signature
        bytes32 hash = calculatePreSignedDocumentHash(sender, receiver, data, nonce);

        require(
            isValidSignature(sender, hash, v, r, s),
            "Signature is not valid."
        );

        require(
            !isExecutedSettlement(sender, hash),
            "A transaction with the same parameters was already executed."
        );

        // Set document
        documents[receiver].push(
            Document(
                sender,
                data,
                block.timestamp,
                0
            )
        );

        setExecutedSettlement(sender, hash);

        emit SetDocument(sender, receiver, data, block.timestamp);
    }

    /**
     * @dev Set openedAt document value with pre signed transaction.
     * @param receiver Address of the document receiver
     * @param index Index of the document which receiver wants to update openedAt
     * @param nonce Nonce used for transaction
     * @param v Value we get from signature
     * @param r Value we get from signature
     * @param s Value we get from signature
     */
    function setPreSignedOpenedAt(
        address receiver,
        uint256 index,
        uint256 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    )
        external
    {
        // Validate sender signature
        bytes32 hash = calculateHash(receiver, index, nonce);

        require(
            isValidSignature(receiver, hash, v, r, s),
            "Signature is not valid."
        );

        require(
            !isExecutedSettlement(receiver, hash),
            "A transaction with the same parameters was already executed."
        );

        require(
            this.getDocumentsCount(receiver) > index,
            "The document does not exist."
        );

        Document storage doc = documents[receiver][index];

        require(
            doc.openedAt == 0,
            "The document was already opened."
        );

        doc.openedAt = block.timestamp;

        setExecutedSettlement(receiver, hash);

        emit SetOpenedAt(receiver, index, doc.openedAt);
    }

    /**
     * @dev Calculate hash used for setPreSignedDocument method
     * @param sender Address of the document sender
     * @param receiver Address of the document receiver
     * @param data Data of the document
     * @param nonce Nonce used for transaction
     * @return keccak256 hash
     */
    function calculatePreSignedDocumentHash(
        address sender,
        address receiver,
        bytes memory data,
        uint256 nonce
    )
        public
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encodePacked(
                uint256(0),
                address(this),
                sender,
                receiver,
                data,
                nonce
            )
        );
    }

    /**
     * @dev Calculate hash used for setPreSignedOpenedAt method
     * @param receiver Address of the document receiver
     * @param index Index of the document which receiver wants to update openedAt
     * @param nonce Nonce used for transaction
     * @return keccak256 hash
     */
    function calculateHash(
        address receiver,
        uint256 index,
        uint256 nonce
    )
        public
        view
        returns (bytes32)
    {
        return keccak256(
            abi.encodePacked(
                uint256(1),
                address(this),
                receiver,
                index,
                nonce
            )
        );
    }

    /**
     * @dev Validate signature
     * @param signer Sender address of the document
     * @param hash Calculated hash from calculated method
     * @param v Value we get from signature
     * @param r Value we get from signature
     * @param s Value we get from signature
     * @return Is valid signature
     */
    function isValidSignature(
        address signer,
        bytes32 hash,
        uint8 v,
        bytes32 r,
        bytes32 s
    )
        public
        pure
        returns (bool)
    {
        return signer == ecrecover(
            keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", hash)),
            v,
            r,
            s
        );
    }

    /**
     * @dev Check if settlement is executed. This is a security mechanism to prevent the possible re-sending of already signed transactions.
     * @param sender Sender address
     * @param hash Calculated hash from calculated method
     */
    function isExecutedSettlement(
        address sender,
        bytes32 hash
    )
        private
        view
        returns (bool)
    {
        return executedSettlements[sender][hash];
    }

    /**
     * @dev Set executed settlement
     * @param sender Sender address
     * @param hash Calculated hash from calculated method
     */
    function setExecutedSettlement(
        address sender,
        bytes32 hash
    )
        private
        returns (bool)
    {
        return executedSettlements[sender][hash] = true;
    }
}

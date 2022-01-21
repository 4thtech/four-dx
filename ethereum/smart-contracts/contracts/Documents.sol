//SPDX-License-Identifier: MIT
pragma solidity ^0.7.1;

/**
 * @title Documents
 * @author Denis Jazbec
 * @notice You can use this contract for storing documents
 * @dev Store & retrieve documents
 */
contract Documents {
    struct Document {
        address sender;
        bytes data;
        uint256 sentAt;
        uint256 openedAt;
    }

    mapping(address => Document[]) internal documents;

    // Events
    event SetDocument(
        address sender,
        address receiver,
        bytes data,
        uint256 sentAt
    );

    event SetOpenedAt(
        address receiver,
        uint256 index,
        uint256 openedAt
    );

    /**
     * @dev Set the document to the recipient.
     * @param receiver Address of the document receiver
     * @param data Data of the document
     */
    function setDocument(address receiver, bytes memory data) external {
        documents[receiver].push(
            Document(
                msg.sender,
                data,
                block.timestamp,
                0
            )
        );

        emit SetDocument(msg.sender, receiver, data, block.timestamp);
    }

    /**
     * @dev Set the document to the recipient.
     * @param receiver Address of the document receiver
     * @param index Index of the document which receiver wants to update openedAt
     */
    function setOpenedAt(address receiver, uint256 index) external {
        require(
            msg.sender == receiver,
            "This can change only receiver of the document."
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

        emit SetOpenedAt(receiver, index, doc.openedAt);
    }

    /**
     * @dev Returns the receiver's document for the given index value.
     * @param receiver Address of the document receiver
     * @param index Index of the document which receiver wants to retrieve
     * @return Sender address
     * @return Document data
     * @return Timestamp of storing document
     * @return Timestamp of opening document
     */
    function getDocument(address receiver, uint256 index)
        external
        view
        returns (address, bytes memory, uint256, uint256)
    {
        require(
            this.getDocumentsCount(receiver) > index,
            "The document does not exist."
        );

        Document storage doc = documents[receiver][index];

        return (doc.sender, doc.data, doc.sentAt, doc.openedAt);
    }

    /**
     * @dev Returns the number of documents for the given receiver.
     * @param receiver Address of the receiver
     * @return Number of documents for given receiver
     */
    function getDocumentsCount(address receiver) external view returns (uint256) {
        return documents[receiver].length;
    }
}

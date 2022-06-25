// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

interface ERC721Token {
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;

    function ownerOf(uint256 tokenId) external view returns (address);
}

error SwapRejected(); //Error that happens when swap ended up with an error
error OnlyNftOwnersCanExecute(); //Only users who hold specific tokens are permitted to execute this function
error SwappedAlready(); //Happens when someone wants to execute the swap on the contract that already has been finished
error SwapExpired(); // Happens when the time for the exchange has expired

contract NftSwapper {
    ERC721Token public immutable nft1Contract;
    ERC721Token public immutable nft2Contract;

    uint256 public immutable nft1Id;
    uint256 public immutable nft2Id;

    uint256 timeInvalidAt;
    uint256 public expiryDate;

    bool swapSucceeded;

    event SwapSucceeded(address swapContractAddress);

    constructor(
        address _nft1,
        uint256 _nft1Id,
        address _nft2,
        uint256 _nft2Id,
        uint256 _expiryDate
    ) {
        nft1Contract = ERC721Token(_nft1);
        nft2Contract = ERC721Token(_nft2);

        nft1Id = _nft1Id;
        nft2Id = _nft2Id;
        expiryDate = _expiryDate;
    }

    function setExpiryDate(uint256 _expiryDate) public {
        expiryDate = _expiryDate;    
    }

    function swap() public makerOrTaker {
        if (swapSucceeded == true) revert SwappedAlready();
        if (block.timestamp > expiryDate) revert SwapExpired();

        address originalOwnerOfNft1 = nft1Contract.ownerOf(nft1Id);
        address originalOwnerOfNft2 = nft2Contract.ownerOf(nft2Id);

        nft1Contract.safeTransferFrom(
            originalOwnerOfNft1,
            originalOwnerOfNft2,
            nft1Id
        );
        nft2Contract.safeTransferFrom(
            originalOwnerOfNft2,
            originalOwnerOfNft1,
            nft2Id
        );

        if (
            nft1Contract.ownerOf(nft1Id) != originalOwnerOfNft2 &&
            nft2Contract.ownerOf(nft2Id) != originalOwnerOfNft1
        ) revert SwapRejected();
    }

    modifier makerOrTaker() {
        address originalOwnerOfNft1 = nft1Contract.ownerOf(nft1Id);
        address originalOwnerOfNft2 = nft2Contract.ownerOf(nft2Id);

        if (
            msg.sender != originalOwnerOfNft1 &&
            msg.sender != originalOwnerOfNft2
        ) revert OnlyNftOwnersCanExecute();
        _;
    }
}

// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;


import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

interface ERC721Token {
    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    ) external;

    function ownerOf(uint256 tokenId) external view returns (address);
}

interface ERC20Token {
    function transferFrom(
        address _from, 
        address _to, 
        uint256 _value
    ) external 
    returns (bool success);
}

error NotNftOwner();
error OnlyMaker();
error FeeTooLow();
error OfferCancelled();
error OfferCompleted();
error NotMakerOrTaker();
error SwapFailed();
error PaymentFailed();

contract NftSwapperNew is Ownable {

    using Counters for Counters.Counter;
    
    enum State { New, Completed, Cancelled } 
    struct SwapOffer {
        uint256 id;
        State state;
        address makerNftAddress;
        uint256 makerNftId;
        address takerNftAddress;
        uint256 takerNftId;
        address makerAddress;
        uint256 swapPayment;
    }

    event SwapStateChanged(uint256 _swapId, State _newState);

    mapping(uint256 => SwapOffer) public swapOffers;
    Counters.Counter private _counter;

    uint256 public swapFee;
    address public immutable wethContractAddress;

    constructor(address _wethContractAddress) {
        wethContractAddress = _wethContractAddress;
    }
    
    /// ** Modifiers ** //

    modifier onlyMaker(uint256 _id) {
        if (swapOffers[_id].makerAddress != msg.sender) revert OnlyMaker();
        _;
    }
    modifier onlyMakerOrTaker(uint256 _swapId) {
        ERC721Token makerNftContract = ERC721Token(swapOffers[_swapId].makerNftAddress);
        ERC721Token takerNftContract = ERC721Token(swapOffers[_swapId].takerNftAddress);
        if (
            makerNftContract.ownerOf(swapOffers[_swapId].makerNftId) != msg.sender &&
            takerNftContract.ownerOf(swapOffers[_swapId].takerNftId) != msg.sender
        ) revert NotMakerOrTaker();
        _;
    }

    /// ** Public methods ** //

    function setSwapFee(uint256 _swapFee) public onlyOwner {
        swapFee = _swapFee;
    }

    function createOffer(
        address _nftAddr1, 
        uint256 _nftId1, 
        address _nftAddr2, 
        uint256 _nftId2,
        address _makerAddress, 
        uint256 _makerToTakerFee
    ) public payable returns (uint256) {
        // check maker is owner of nft
        if (msg.value < swapFee) revert FeeTooLow();
        uint256 _id = _counter.current();
        SwapOffer memory _swapOffer = SwapOffer(_id, State.New, _nftAddr1, _nftId1, _nftAddr2, _nftId2, _makerAddress, _makerToTakerFee);
        swapOffers[_id] = _swapOffer;
        
        emit SwapStateChanged(_id, State.New);
        _counter.increment();
        return _id;
    }

    function cancelSwap(uint256 _swapId) public onlyMaker(_swapId) {
        if (swapOffers[_swapId].state == State.Cancelled) revert OfferCancelled();
        if (swapOffers[_swapId].state == State.Completed) revert OfferCompleted();
        swapOffers[_swapId].state = State.Cancelled;
        emit SwapStateChanged(_swapId, State.Cancelled);
    }

    function makeSwap(uint256 _swapId) public payable onlyMakerOrTaker(_swapId) {
        if (swapOffers[_swapId].state == State.Cancelled) revert OfferCancelled();
        if (swapOffers[_swapId].state == State.Completed) revert OfferCompleted();
        
        SwapOffer storage swapOffer = swapOffers[_swapId];
        uint256 swapPayment = swapOffer.swapPayment;
        address offerMakerAddress = swapOffer.makerAddress;
        uint256 makerNftId = swapOffer.makerNftId;
        uint256 takerNftId = swapOffer.takerNftId;

        ERC721Token makerNftContract = ERC721Token(swapOffer.makerNftAddress);
        ERC721Token takerNftContract = ERC721Token(swapOffer.takerNftAddress);
        
        address owner1 = makerNftContract.ownerOf(makerNftId);
        address owner2 = takerNftContract.ownerOf(takerNftId);
        address maker;
        address taker;
        if (owner1 == offerMakerAddress) {
            maker = owner1;
            taker = owner2;
        } else {
            maker = owner2;
            taker = owner1;
        }

        makerNftContract.safeTransferFrom(maker, taker, makerNftId);
        takerNftContract.safeTransferFrom(taker, maker, takerNftId);
        if (swapPayment != 0) {
            ERC20Token wethContract = ERC20Token(wethContractAddress);
            bool paymentSuccessful = wethContract.transferFrom(maker, taker, swapPayment);
            if (!paymentSuccessful) revert PaymentFailed();
        }
        if (!(makerNftContract.ownerOf(makerNftId) == taker && 
            takerNftContract.ownerOf(takerNftId) == maker)) revert SwapFailed();
        
        swapOffer.state = State.Completed;
        emit SwapStateChanged(_swapId, State.Completed);
        
    }

    




    // address constant swapperSafe = payable(0x32d15a580F87D5dabCDF759cfdC4A6401e4488bc);
    // ERC721Token public nft1Contract;
    // ERC721Token public nft2Contract;
    
    // ERC20Token public wethContract;

    // uint256 public nft1Id;
    // uint256 public nft2Id;

    // uint256 timeCreated;
    // uint256 public swapFee;
    // uint256 swapPrice;

    // bool public swapSucceeded;
    // bool public swapCancelled;

    // function create(
    //     address _nft1,
    //     uint256 _nft1Id,
    //     address _nft2,
    //     uint256 _nft2Id,
    //     uint256 _swapFee,
    //     address _wethAddress,
    //     uint256 _swapPrice
    // ) public {
    //     nft1Contract = ERC721Token(_nft1);
    //     nft2Contract = ERC721Token(_nft2);

    //     nft1Id = _nft1Id;
    //     nft2Id = _nft2Id;

    //     timeCreated = block.timestamp;
    //     swapFee = _swapFee;

    //     wethContract = ERC20Token(_wethAddress);
    //     swapPrice = _swapPrice;
    // }

    // function cancelSwap() public makerOrTaker {
    //     swapCancelled = true;
    // }

    // function getSwapperStatus() public view returns(address, uint256, address, uint256, bool, bool){
    //     return(address(nft1Contract), nft1Id, address(nft2Contract), nft2Id, swapSucceeded, swapCancelled);
    // }   

    // function swap() public payable makerOrTaker {
    //     if (swapSucceeded == true) revert SwappedAlready();
    //     if (swapCancelled == true) revert SwapCancelled();
    //     if (block.timestamp > timeCreated + 1 days) revert OfferExpired();
    //     if (msg.value < swapFee) revert FeeTooLow();
    //     // require (block.timestamp < timeCreated + 1 days, "The offer has expired");
    //     // require (msg.value >= swapFee, "Fee too low.");
    //     address originalOwnerOfNft1 = nft1Contract.ownerOf(nft1Id);
    //     address originalOwnerOfNft2 = nft2Contract.ownerOf(nft2Id);
        
    //     wethContract.transferFrom(originalOwnerOfNft1, originalOwnerOfNft2, swapPrice);
    //     nft1Contract.safeTransferFrom(
    //         originalOwnerOfNft1,
    //         originalOwnerOfNft2,
    //         nft1Id
    //     );
    //     nft2Contract.safeTransferFrom(
    //         originalOwnerOfNft2,
    //         originalOwnerOfNft1,
    //         nft2Id
    //     );

    //     if (
    //         !(nft1Contract.ownerOf(nft1Id) == originalOwnerOfNft2 &&
    //           nft2Contract.ownerOf(nft2Id) == originalOwnerOfNft1)
    //     ) revert SwapRejected();
    //     (bool sent, ) = swapperSafe.call{value: msg.value}("");
    //     require(sent, "Something went wrong with transferring fee");
    //     swapSucceeded = true;
    // }

    // modifier makerOrTaker() {
    //     address originalOwnerOfNft1 = nft1Contract.ownerOf(nft1Id);
    //     address originalOwnerOfNft2 = nft2Contract.ownerOf(nft2Id);

    //     if (
    //         msg.sender != originalOwnerOfNft1 &&
    //         msg.sender != originalOwnerOfNft2
    //     ) revert OnlyNftOwnersCanExecute();
    //     _;
    // }
}

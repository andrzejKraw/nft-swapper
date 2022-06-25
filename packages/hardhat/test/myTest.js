const { ethers } = require("hardhat");
const { use, expect } = require("chai");
const { solidity } = require("ethereum-waffle");

use(solidity);

describe("Nft Swapper", function () {
  let owner, addr1, addr2;
  let nftContract;
  let factoryContract;

  // quick fix to let gas reporter fetch data from gas station & coinmarketcap
  before((done) => {
    setTimeout(done, 2000);
  });


  describe("SampleNft", function () {
    it("Should deploy SampleNft", async function () {
      const SampleNft = await ethers.getContractFactory("SampleNft");
      
      nftContract = await SampleNft.deploy();
    });

    it("Should safe mint 2 NFTs for 2 different accounts", async function () {
      [owner, addr1, addr2] = await ethers.getSigners();
      nftContract.connect(owner).safeMint(addr1.address);
      nftContract.connect(owner).safeMint(addr2.address);

    });
  });
    
  describe("NftSwapperFactory", function () {
    it("Should deploy NftSwapperFactory", async function () {
      const NftSwapperFactory = await ethers.getContractFactory("NftSwapperFactory");

      factoryContract = await NftSwapperFactory.deploy();
    });
    
    
    describe("deploy NFTSwapper", function () {
      const nowSeconds = Math.round(new Date().getTime()/1000);
      it("Should be able to deploy new NftSwapper instance", async function () {
        let nftSwapperInstanceAddress = await factoryContract.currentNftSwapperContract();
        expect(nftSwapperInstanceAddress).to.equal("0x0000000000000000000000000000000000000000");
        
        await factoryContract.create(nftContract.address, 0, nftContract.address, 1, nowSeconds);
        nftSwapperInstanceAddress = await factoryContract.currentNftSwapperContract(); 
        expect(nftSwapperInstanceAddress).to.not.equal("0x0000000000000000000000000000000000000000");
      });
    });
  });
  
  describe("NftSwapper instance", async function() {
    let nftSwapperInstanceAddress; 
    let NftSwapper; 

    it("Should revert when expiry date in the past ", async function () {
      nftSwapperInstanceAddress = await factoryContract.currentNftSwapperContract();
      NftSwapper = await ethers.getContractAt('NftSwapper', nftSwapperInstanceAddress);
      await NftSwapper.setExpiryDate(Math.round(new Date().getTime()/1000) - 10);
      await expect( NftSwapper.connect(addr1).swap()).to.be.reverted; // change this to check for specific error 
    });

  });




});

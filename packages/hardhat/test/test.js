const { ethers } = require("hardhat");
const { use, expect } = require("chai");
const { solidity } = require("ethereum-waffle");

use(solidity);

describe("NFT Swapper New", async() => {
  let deployer;
  let addr1; 
  let addr2;
  let wethInstance;
  let nftInstance
  let nftSwapper;


  describe("Initialize contract", async() => {
    // before(async() => {
      
      //   // const sampleNft = await ethers.getContractFactory("SampleNft");
      //   // sampleNft 
      // });
      
    it("Should deploy NftSwapper", async() => {
      [deployer, addr1, addr2] = await ethers.getSigners();
      const Weth = await ethers.getContractFactory("WETH9");
      wethInstance = await Weth.deploy();
      const NftSwapper = await ethers.getContractFactory("NftSwapperNew");
      nftSwapper = await NftSwapper.deploy(wethInstance.address);
      expect(nftSwapper.address).to.not.be.equal(0);
      expect(await nftSwapper.wethContractAddress()).to.be.equal(wethInstance.address);
    });
    
    it("Should deposit weth to testing accounts", async() => {
      const initialBalance = "0.5";
      await wethInstance.connect(addr1).deposit({value: ethers.utils.parseEther(initialBalance)});
      await wethInstance.connect(addr2).deposit({value: ethers.utils.parseEther(initialBalance)});
      const addr1Balance = await wethInstance.balanceOf(addr1.address);
      const addr2Balance = await wethInstance.balanceOf(addr2.address);
      
      expect(addr1Balance).to.be.equal(ethers.utils.parseEther(initialBalance));
      expect(addr2Balance).to.be.equal(ethers.utils.parseEther(initialBalance));
    });
    
    it("Should deploy test NFT contract", async() => {
      const NftContract = await ethers.getContractFactory("NftContract");
      nftInstance = await NftContract.deploy("TestNftContract", "TNC");
      expect(nftInstance.address).to.not.be.equal(0);
    });

    // it("Should batch mint some NFTs for testing accounts", async() => {
    //   await nftInstance.batchMintNfts(addr1.address, 20);
    //   await nftInstance.batchMintNfts(addr2.address, 20);
    // });
  });

  describe("NFT Swap within same collection", async() => {
    const makerId = 1;
    const takerId = 21; 
    beforeEach(async() => {
      const NftContract = await ethers.getContractFactory("NftContract");
      nftInstance = await NftContract.deploy("TestNftContract", "TNC");
      await nftInstance.batchMintNfts(addr1.address, 20);
      await nftInstance.batchMintNfts(addr2.address, 20);
    });

    it("Should create swap offer without additional payment", async() => {
      const { address  }= nftInstance;
      
      await expect(nftSwapper.connect(addr1).createOffer(address, makerId, address, takerId, addr1.address, 0))
        .to.emit(nftSwapper, "SwapStateChanged")
        .withArgs("0", 0);
    });

    it("Should be able to cancel swap", async() => {
      const { address  } = nftInstance;
      const tx = await nftSwapper.connect(addr1).createOffer(address, makerId, address, takerId, addr1.address, 0);
      const rc = await tx.wait(); 
      const event = rc.events.find(event => event.event === 'SwapStateChanged');
      const [swapId, newState] = event.args;
      
      await expect(nftSwapper.connect(addr1).cancelSwap(swapId))
      .to.emit(nftSwapper, "SwapStateChanged")
      .withArgs(swapId, 2);
    });
    
    it("Should be able to perform simple swap by maker", async() => {
      const { address  } = nftInstance;
      expect(await nftInstance.ownerOf(makerId)).to.be.equal(addr1.address);
      expect(await nftInstance.ownerOf(takerId)).to.be.equal(addr2.address);

      const tx = await nftSwapper.connect(addr1).createOffer(address, makerId, address, takerId, addr1.address, 0);
      const rc = await tx.wait(); 
      const event = rc.events.find(event => event.event === 'SwapStateChanged');
      const [swapId, newState] = event.args;
      await nftInstance.connect(addr1).approve(nftSwapper.address, makerId);
      await nftInstance.connect(addr2).approve(nftSwapper.address, takerId);

      expect(await nftSwapper.connect(addr1).makeSwap(swapId))
        .to.emit(nftSwapper, "SwapStateChanged")
        .withArgs(swapId, 1);
     
      expect(await nftInstance.ownerOf(makerId)).to.be.equal(addr2.address);
      expect(await nftInstance.ownerOf(takerId)).to.be.equal(addr1.address);

    });

    it("Should be able to perform simple swap by taker", async() => {
      const { address  } = nftInstance;
      expect(await nftInstance.ownerOf(makerId)).to.be.equal(addr1.address);
      expect(await nftInstance.ownerOf(takerId)).to.be.equal(addr2.address);

      const tx = await nftSwapper.connect(addr1).createOffer(address, makerId, address, takerId, addr1.address, 0);
      const rc = await tx.wait(); 
      const event = rc.events.find(event => event.event === 'SwapStateChanged');
      const [swapId, newState] = event.args;
      await nftInstance.connect(addr1).approve(nftSwapper.address, makerId);
      await nftInstance.connect(addr2).approve(nftSwapper.address, takerId);

      expect(await nftSwapper.connect(addr2).makeSwap(swapId))
        .to.emit(nftSwapper, "SwapStateChanged")
        .withArgs(swapId, 1);
     
      expect(await nftInstance.ownerOf(makerId)).to.be.equal(addr2.address);
      expect(await nftInstance.ownerOf(takerId)).to.be.equal(addr1.address);

    });

    it("Should accept additional WETH payments to taker", async() => {
      const swapPayment = ethers.utils.parseEther("0.1");
      const { address  } = nftInstance;
      expect(await nftInstance.ownerOf(makerId)).to.be.equal(addr1.address);
      expect(await nftInstance.ownerOf(takerId)).to.be.equal(addr2.address);

      const tx = await nftSwapper.connect(addr1).createOffer(address, makerId, address, takerId, addr1.address, swapPayment);
      const rc = await tx.wait(); 
      const event = rc.events.find(event => event.event === 'SwapStateChanged');
      const [swapId, newState] = event.args;
      await nftInstance.connect(addr1).approve(nftSwapper.address, makerId);
      await nftInstance.connect(addr2).approve(nftSwapper.address, takerId);
      
      const beforeMakerBalance = await wethInstance.balanceOf(addr1.address);
      const beforeTakerBalance = await wethInstance.balanceOf(addr2.address);

      await wethInstance.connect(addr1).approve(nftSwapper.address, swapPayment);

      expect(await nftSwapper.connect(addr2).makeSwap(swapId))
        .to.emit(nftSwapper, "SwapStateChanged")
        .withArgs(swapId, 1); 
     
      expect(await nftInstance.ownerOf(makerId)).to.be.equal(addr2.address);
      expect(await nftInstance.ownerOf(takerId)).to.be.equal(addr1.address);
      
      expect(await wethInstance.balanceOf(addr1.address)).to.equal(beforeMakerBalance.sub(swapPayment));
      expect(await wethInstance.balanceOf(addr2.address)).to.equal(beforeTakerBalance.add(swapPayment));
    });

    it("Should not allow to swap cancelled swaps", async() => {
      const { address  } = nftInstance;
      expect(await nftInstance.ownerOf(makerId)).to.be.equal(addr1.address);
      expect(await nftInstance.ownerOf(takerId)).to.be.equal(addr2.address);

      const tx = await nftSwapper.connect(addr1).createOffer(address, makerId, address, takerId, addr1.address, 0);
      const rc = await tx.wait(); 
      const event = rc.events.find(event => event.event === 'SwapStateChanged');
      const [swapId, newState] = event.args;
      await nftInstance.connect(addr1).approve(nftSwapper.address, makerId);
      await nftInstance.connect(addr2).approve(nftSwapper.address, takerId);

      await nftSwapper.connect(addr1).cancelSwap(swapId);


      await expect(nftSwapper.connect(addr2).makeSwap(swapId))
        .to.be.revertedWith("OfferCancelled");
    });

    it("Should revert already completed swap", async() => {
      const { address  } = nftInstance;
      expect(await nftInstance.ownerOf(makerId)).to.be.equal(addr1.address);
      expect(await nftInstance.ownerOf(takerId)).to.be.equal(addr2.address);

      const tx = await nftSwapper.connect(addr1).createOffer(address, makerId, address, takerId, addr1.address, 0);
      const rc = await tx.wait(); 
      const event = rc.events.find(event => event.event === 'SwapStateChanged');
      const [swapId, newState] = event.args;
      await nftInstance.connect(addr1).approve(nftSwapper.address, makerId);
      await nftInstance.connect(addr2).approve(nftSwapper.address, takerId);

      expect(await nftSwapper.connect(addr2).makeSwap(swapId))
        .to.emit(nftSwapper, "SwapStateChanged")
        .withArgs(swapId, 1);
     
      expect(await nftInstance.ownerOf(makerId)).to.be.equal(addr2.address);
      expect(await nftInstance.ownerOf(takerId)).to.be.equal(addr1.address);

      await expect(nftSwapper.connect(addr2).makeSwap(swapId))
        .to.be.revertedWith("OfferCompleted");

    });
  });
})

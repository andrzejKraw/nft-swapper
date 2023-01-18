const { ethers } = require("hardhat");
const { use, expect } = require("chai");
const { solidity } = require("ethereum-waffle");

use(solidity);

describe("NFT Swapper New", async() => {
  let deployer,
      addr1,
      addr2,
      addr3,
      wethInstance,
      nftInstance,
      nftInstanceOther,
      nftSwapper;


  describe("Initialize contract", async() => {
    // before(async() => {
      
      //   // const sampleNft = await ethers.getContractFactory("SampleNft");
      //   // sampleNft 
      // });
      
    it("Should deploy NftSwapper", async() => {
      [deployer, addr1, addr2, addr3] = await ethers.getSigners();
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

    // it("Should allow cancelling swap offers by maker", async() => {
    //   const { address } = nftInstance;
    //   const tx = await nftSwapper.connect(addr1).createOffer(address, makerId, address, takerId, addr1.address, 0);
    //   const rc = await tx.wait(); 
    //   const event = rc.events.find(event => event.event === 'SwapStateChanged');
    //   const [swapId, newState] = event.args;

    //   expect(await nftSwapper.connect(addr1).cancelSwap(swapId)).to.emit(nftSwapper, "SwapStateChanged");
    // });

    it("Should not allow to cancel swap by other address", async() =>{
      const { address } = nftInstance;
      const tx = await nftSwapper.connect(addr1).createOffer(address, makerId, address, takerId, addr1.address, 0);
      const rc = await tx.wait(); 
      const event = rc.events.find(event => event.event === 'SwapStateChanged');
      const [swapId, newState] = event.args;

      await expect(nftSwapper.connect(addr3).cancelSwap(swapId)).to.be.revertedWith("OnlyMaker");
    });

    it("Should not allow completing the swap by other address", async() => {
      const { address } = nftInstance;
      const tx = await nftSwapper.connect(addr1).createOffer(address, makerId, address, takerId, addr1.address, 0);
      const rc = await tx.wait(); 
      const event = rc.events.find(event => event.event === 'SwapStateChanged');
      const [swapId, newState] = event.args;

      await nftInstance.connect(addr1).approve(nftSwapper.address, makerId);
      await nftInstance.connect(addr2).approve(nftSwapper.address, takerId);

      await expect(nftSwapper.connect(addr3).makeSwap(swapId))
        .to.be.revertedWith("NotMakerOrTaker");
    });
  });

  describe("Perform swaps between different collections", ()=> {
    const makerId = 1;
    const takerId = 5; 
    let nftSwapperInstance;
    beforeEach(async() => {
      const NftSwapper = await ethers.getContractFactory("NftSwapperNew");
      nftSwapperInstance = await NftSwapper.deploy(wethInstance.address);
      const NftContract = await ethers.getContractFactory("NftContract");
      nftInstance = await NftContract.deploy("TestNftContract", "TNC");
      const NftContractOther = await ethers.getContractFactory("NftContractOther");
      nftInstanceOther = await NftContractOther.deploy("TestNftContract", "TNC2");
      await nftInstance.batchMintNfts(addr1.address, 20);
      await nftInstanceOther.batchMintNfts(addr2.address, 20);
    });

    it("Should create swap offer without additional payment", async() => {
      const { address  } = nftInstance;
      const otherNftAddress = nftInstance.address;
      
      await expect(nftSwapperInstance.connect(addr1).createOffer(address, makerId, otherNftAddress, takerId, addr1.address, 0))
        .to.emit(nftSwapperInstance, "SwapStateChanged")
        .withArgs("0", 0);
    });

    // it("Should be able to cancel swap", async() => {
    //   const { address  } = nftInstance;
    //   const tx = await nftSwapperInstance.connect(addr1).createOffer(address, makerId, address, takerId, addr1.address, 0);
    //   const rc = await tx.wait(); 
    //   const event = rc.events.find(event => event.event === 'SwapStateChanged');
    //   const [swapId, newState] = event.args;
      
    //   await expect(nftSwapperInstance.connect(addr1).cancelSwap(swapId))
    //   .to.emit(nftSwapperInstance, "SwapStateChanged")
    //   .withArgs(swapId, 2);
    // });
    
    it("Should be able to perform simple swap by maker", async() => {
      const { address  } = nftInstance;
      const otherNftAddress = nftInstanceOther.address;
      expect(await nftInstance.ownerOf(makerId)).to.be.equal(addr1.address);
      expect(await nftInstanceOther.ownerOf(takerId)).to.be.equal(addr2.address);

      const tx = await nftSwapperInstance.connect(addr1).createOffer(address, makerId, otherNftAddress, takerId, addr1.address, 0);
      const rc = await tx.wait(); 
      const event = rc.events.find(event => event.event === 'SwapStateChanged');
      const [swapId, newState] = event.args;
      await nftInstance.connect(addr1).approve(nftSwapperInstance.address, makerId);
      await nftInstanceOther.connect(addr2).approve(nftSwapperInstance.address, takerId);

      expect(await nftSwapperInstance.connect(addr1).makeSwap(swapId))
        .to.emit(nftSwapperInstance, "SwapStateChanged")
        .withArgs(swapId, 1);
     
      expect(await nftInstance.ownerOf(makerId)).to.be.equal(addr2.address);
      expect(await nftInstanceOther.ownerOf(takerId)).to.be.equal(addr1.address);

    });

    it("Should be able to perform simple swap by taker", async() => {
      const { address  } = nftInstance;
      const otherNftAddress = nftInstanceOther.address;
      expect(await nftInstance.ownerOf(makerId)).to.be.equal(addr1.address);
      expect(await nftInstanceOther.ownerOf(takerId)).to.be.equal(addr2.address);

      const tx = await nftSwapperInstance.connect(addr1).createOffer(address, makerId, otherNftAddress, takerId, addr1.address, 0);
      const rc = await tx.wait(); 
      const event = rc.events.find(event => event.event === 'SwapStateChanged');
      const [swapId, newState] = event.args;
      await nftInstance.connect(addr1).approve(nftSwapperInstance.address, makerId);
      await nftInstanceOther.connect(addr2).approve(nftSwapperInstance.address, takerId);

      expect(await nftSwapperInstance.connect(addr2).makeSwap(swapId))
        .to.emit(nftSwapperInstance, "SwapStateChanged")
        .withArgs(swapId, 1);
     
      expect(await nftInstance.ownerOf(makerId)).to.be.equal(addr2.address);
      expect(await nftInstanceOther.ownerOf(takerId)).to.be.equal(addr1.address);

    });

    it("Should accept additional WETH payments to taker", async() => {
      const swapPayment = ethers.utils.parseEther("0.1");
      const { address  } = nftInstance;
      const otherNftAddress = nftInstanceOther.address;
      expect(await nftInstance.ownerOf(makerId)).to.be.equal(addr1.address);
      expect(await nftInstanceOther.ownerOf(takerId)).to.be.equal(addr2.address);

      const tx = await nftSwapperInstance.connect(addr1).createOffer(address, makerId, otherNftAddress, takerId, addr1.address, swapPayment);
      const rc = await tx.wait(); 
      const event = rc.events.find(event => event.event === 'SwapStateChanged');
      const [swapId, newState] = event.args;
      await nftInstance.connect(addr1).approve(nftSwapperInstance.address, makerId);
      await nftInstanceOther.connect(addr2).approve(nftSwapperInstance.address, takerId);
      
      const beforeMakerBalance = await wethInstance.balanceOf(addr1.address);
      const beforeTakerBalance = await wethInstance.balanceOf(addr2.address);

      await wethInstance.connect(addr1).approve(nftSwapperInstance.address, swapPayment);

      expect(await nftSwapperInstance.connect(addr2).makeSwap(swapId))
        .to.emit(nftSwapperInstance, "SwapStateChanged")
        .withArgs(swapId, 1); 
     
      expect(await nftInstance.ownerOf(makerId)).to.be.equal(addr2.address);
      expect(await nftInstanceOther.ownerOf(takerId)).to.be.equal(addr1.address);
      
      expect(await wethInstance.balanceOf(addr1.address)).to.equal(beforeMakerBalance.sub(swapPayment));
      expect(await wethInstance.balanceOf(addr2.address)).to.equal(beforeTakerBalance.add(swapPayment));
    });

    // it("Should not allow to swap cancelled swaps", async() => {
    //   const { address  } = nftInstance;
    //   expect(await nftInstance.ownerOf(makerId)).to.be.equal(addr1.address);
    //   expect(await nftInstance.ownerOf(takerId)).to.be.equal(addr2.address);

    //   const tx = await nftSwapperInstance.connect(addr1).createOffer(address, makerId, address, takerId, addr1.address, 0);
    //   const rc = await tx.wait(); 
    //   const event = rc.events.find(event => event.event === 'SwapStateChanged');
    //   const [swapId, newState] = event.args;
    //   await nftInstance.connect(addr1).approve(nftSwapperInstance.address, makerId);
    //   await nftInstance.connect(addr2).approve(nftSwapperInstance.address, takerId);

    //   await nftSwapperInstance.connect(addr1).cancelSwap(swapId);


    //   await expect(nftSwapperInstance.connect(addr2).makeSwap(swapId))
    //     .to.be.revertedWith("OfferCancelled");
    // });

    // it("Should revert already completed swap", async() => {
    //   const { address  } = nftInstance;
    //   expect(await nftInstance.ownerOf(makerId)).to.be.equal(addr1.address);
    //   expect(await nftInstance.ownerOf(takerId)).to.be.equal(addr2.address);

    //   const tx = await nftSwapperInstance.connect(addr1).createOffer(address, makerId, address, takerId, addr1.address, 0);
    //   const rc = await tx.wait(); 
    //   const event = rc.events.find(event => event.event === 'SwapStateChanged');
    //   const [swapId, newState] = event.args;
    //   await nftInstance.connect(addr1).approve(nftSwapperInstance.address, makerId);
    //   await nftInstance.connect(addr2).approve(nftSwapperInstance.address, takerId);

    //   expect(await nftSwapperInstance.connect(addr2).makeSwap(swapId))
    //     .to.emit(nftSwapperInstance, "SwapStateChanged")
    //     .withArgs(swapId, 1);
     
    //   expect(await nftInstance.ownerOf(makerId)).to.be.equal(addr2.address);
    //   expect(await nftInstance.ownerOf(takerId)).to.be.equal(addr1.address);

    //   await expect(nftSwapperInstance.connect(addr2).makeSwap(swapId))
    //     .to.be.revertedWith("OfferCompleted");

    // });


    // it("Should not allow to cancel swap by other address", async() =>{
    //   const { address } = nftInstance;
    //   const tx = await nftSwapperInstance.connect(addr1).createOffer(address, makerId, address, takerId, addr1.address, 0);
    //   const rc = await tx.wait(); 
    //   const event = rc.events.find(event => event.event === 'SwapStateChanged');
    //   const [swapId, newState] = event.args;

    //   await expect(nftSwapperInstance.connect(addr3).cancelSwap(swapId)).to.be.revertedWith("OnlyMaker");
    // });

    // it("Should not allow completing the swap by other address", async() => {
    //   const { address } = nftInstance;
    //   const tx = await nftSwapperInstance.connect(addr1).createOffer(address, makerId, address, takerId, addr1.address, 0);
    //   const rc = await tx.wait(); 
    //   const event = rc.events.find(event => event.event === 'SwapStateChanged');
    //   const [swapId, newState] = event.args;

    //   await nftInstance.connect(addr1).approve(nftSwapperInstance.address, makerId);
    //   await nftInstance.connect(addr2).approve(nftSwapperInstance.address, takerId);

    //   await expect(nftSwapperInstance.connect(addr3).makeSwap(swapId))
    //     .to.be.revertedWith("NotMakerOrTaker");
    // });
  });
})



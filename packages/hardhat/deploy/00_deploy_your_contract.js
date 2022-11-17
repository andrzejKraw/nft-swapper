// deploy/00_deploy_your_contract.js

const { ethers } = require("hardhat");


module.exports = async ({ getNamedAccounts, deployments }) => {
  const MY_BURNER_ADDRESS = "0xB348da82a6981bd7c61EBf93aea60F1f092F3F03";
  const MY_BURNER_ADDRESS_2 = "0xdc359946C039d1f91F9D84C620f6F2E391742e17";
  const START_UNITS = ethers.utils.parseEther("1");
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();

  await deploy("WETH9", {
    from: deployer,
    log: true,
    waitConfirmations: 1,
  });
 
  const wethContract = await ethers.getContract("WETH9", deployer);
  await wethContract.deposit({value: START_UNITS});
  await wethContract.transfer(MY_BURNER_ADDRESS, ethers.utils.parseEther("0.5")); 
  await wethContract.transfer(MY_BURNER_ADDRESS_2, ethers.utils.parseEther("0.5")); 
 
  // // NFT deployment
  await deploy("NftContract", {
    from: deployer,
    args: ["TestNftContract", "TNC"],
    log: true,
    waitConfirmations: 1,
  });

  const NftContract = await ethers.getContract("NftContract", deployer);
 
  await NftContract.batchMintNfts(MY_BURNER_ADDRESS, 10);
  await NftContract.batchMintNfts(MY_BURNER_ADDRESS_2, 10);
  await NftContract.batchMintNfts(deployer, 100);
  await NftContract.transferOwnership(MY_BURNER_ADDRESS);
  // // NFT deployment
  



  await deploy("NftSwapper", {
    from: deployer,
    log: true,
    waitConfirmations: 1,
  });

  const NftSwapper = await ethers.getContract("NftSwapper", deployer);

  await deploy("NftSwapperFactory", {
    from: deployer,
    args: [NftSwapper.address],
    log: true,
    waitConfirmations: 1,
  });
  const NftSwapperFactory = await ethers.getContract("NftSwapperFactory", deployer);
  await NftSwapperFactory.transferOwnership(
    MY_BURNER_ADDRESS
  );
};

module.exports.tags = ["NftSwapper", "NftSwapperFactory"];

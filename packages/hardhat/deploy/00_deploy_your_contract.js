// deploy/00_deploy_your_contract.js

const { ethers } = require("hardhat");

module.exports = async ({ getNamedAccounts, deployments }) => {
  const { deploy } = deployments;
  const { deployer } = await getNamedAccounts();
  const nowSeconds = Math.round(new Date().getTime()/1000);
  
  await deploy("SampleNft", {
    from: deployer,
    log: true,
    waitConfirmations: 1,
  });

  const SampleNft = await ethers.getContract("SampleNft", deployer);
  await SampleNft.transferOwnership(
    "0x6A64ed43d22fBfAdcddbF17FA0c52c388b4925e1"
  );

  await deploy("NftSwapper", {
    from: deployer,
    args: [SampleNft.address, 0, SampleNft.address, 1, nowSeconds + 30],
    log: true,
    waitConfirmations: 1,
  });

  await deploy("NftSwapperFactory", {
    from: deployer,
    log: true,
    waitConfirmations: 1,
  });

  // const NftSwapper = await ethers.getContract("NftSwapper", deployer);
};

module.exports.tags = ["NftSwapper", "SampleNft"];

const { ethers, upgrades } = require("hardhat");

async function main() {
  const WPAWToken = await ethers.getContractFactory("WPAWToken");
  const wpaw = await upgrades.deployProxy(WPAWToken);
  await wpaw.deployed();
  console.log("wPAW deployed to:", wpaw.address);
}

main();

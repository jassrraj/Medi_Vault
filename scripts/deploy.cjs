const hre = require('hardhat');

async function main() {
  const EHRAccess = await hre.ethers.getContractFactory('EHRAccess');
  const contract = await EHRAccess.deploy();
  await contract.waitForDeployment();
  console.log(`EHRAccess deployed to: ${await contract.getAddress()}`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; });

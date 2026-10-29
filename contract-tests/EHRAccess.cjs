const { expect } = require('chai');
const { ethers } = require('hardhat');

describe('EHRAccess', function () {
  async function deployRecord() {
    const [patient, clinician, other] = await ethers.getSigners();
    const access = await (await ethers.getContractFactory('EHRAccess')).deploy();
    await access.waitForDeployment();
    const cid = 'bafybeigdyrzt5encryptedrecordexample';
    const contentHash = ethers.keccak256(ethers.toUtf8Bytes('encrypted-file-bytes'));
    await access.connect(patient).registerRecord(cid, contentHash);
    return { access, patient, clinician, other, cid, contentHash };
  }

  it('lets only the patient grant and revoke clinician access', async function () {
    const { access, patient, clinician, other } = await deployRecord();
    await expect(access.connect(other).grantAccess(1, clinician.address)).to.be.revertedWith('Only record owner');
    await access.connect(patient).grantAccess(1, clinician.address);
    expect(await access.canAccess(1, clinician.address)).to.equal(true);
    await access.connect(patient).revokeAccess(1, clinician.address);
    expect(await access.canAccess(1, clinician.address)).to.equal(false);
  });

  it('returns a record only to its owner or an approved clinician', async function () {
    const { access, patient, clinician, other, cid } = await deployRecord();
    await expect(access.connect(other).getRecord(1)).to.be.revertedWith('Access denied');
    expect((await access.connect(patient).getRecord(1)).ipfsCid).to.equal(cid);
    await access.connect(patient).grantAccess(1, clinician.address);
    expect((await access.connect(clinician).getRecord(1)).ipfsCid).to.equal(cid);
  });
});

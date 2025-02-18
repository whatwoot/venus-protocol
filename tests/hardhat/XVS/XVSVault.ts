import { loadFixture, mine } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { BigNumber, Wallet } from "ethers";
import { ethers } from "hardhat";

import { XVS, XVSStore, XVSVaultScenario } from "../../../typechain";

const bigNumber18 = BigNumber.from("1000000000000000000"); // 1e18
const rewardPerBlock = bigNumber18.mul(1);
const lockPeriod = 300;
const allocPoint = 100;
const poolId = 0;

interface XVSVaultFixture {
  xvsVault: XVSVaultScenario;
  xvs: XVS;
  xvsStore: XVSStore;
}

describe("XVSVault", async () => {
  let deployer: Wallet;
  let user: Wallet;
  let xvs: XVS;
  let xvsVault: XVSVaultScenario;
  let xvsStore: XVSStore;

  before("get signers", async () => {
    [deployer, user] = await (ethers as any).getSigners();
  });

  async function deployXVSVaultFixture(): Promise<XVSVaultFixture> {
    const xvsFactory = await ethers.getContractFactory("XVS");
    xvs = (await xvsFactory.deploy(deployer.address)) as XVS;

    const xvsStoreFactory = await ethers.getContractFactory("XVSStore");
    xvsStore = (await xvsStoreFactory.deploy()) as XVSStore;

    const xvsVaultFactory = await ethers.getContractFactory("XVSVaultScenario");
    xvsVault = (await xvsVaultFactory.deploy()) as XVSVaultScenario;

    return { xvsVault, xvs, xvsStore };
  }

  beforeEach("deploy and configure XVSVault contracts", async () => {
    ({ xvsVault, xvs, xvsStore } = await loadFixture(deployXVSVaultFixture));

    await xvsStore.setNewOwner(xvsVault.address);
    await xvsVault.setXvsStore(xvs.address, xvsStore.address);
    await xvs.connect(deployer).transfer(xvsStore.address, bigNumber18.mul(1000));
    await xvs.connect(deployer).transfer(user.address, bigNumber18.mul(1000));

    await xvsStore.setRewardToken(xvs.address, true);

    await xvsVault.add(xvs.address, allocPoint, xvs.address, rewardPerBlock, lockPeriod);
  });

  it("check xvs balance", async () => {
    expect(await xvs.balanceOf(xvsStore.address)).to.eq(bigNumber18.mul(1000));
  });

  it("check if pool exists", async () => {
    const pool = await xvsVault.poolInfos(xvs.address, 0);
    expect(pool.token).to.eq(xvs.address);
    expect(pool.allocPoint).to.eq(allocPoint);
    expect(pool.accRewardPerShare).to.eq(0);
    expect(pool.lockPeriod).to.eq(lockPeriod);
  });

  it("earn reward for staking", async () => {
    const depositAmount = bigNumber18.mul(100);

    await xvs.approve(xvsVault.address, depositAmount);
    await xvsVault.deposit(xvs.address, poolId, depositAmount);

    expect(await xvs.balanceOf(xvsVault.address)).to.eq(depositAmount);

    const userInfo = await xvsVault.getUserInfo(xvs.address, poolId, deployer.address);

    expect(userInfo.amount).to.eq(depositAmount);
    expect(userInfo.rewardDebt).to.eq(0);

    await mine(1000);

    let previousXVSBalance = ethers.utils.formatEther((await xvs.balanceOf(deployer.address)).toString());

    await xvsVault.requestWithdrawal(xvs.address, poolId, depositAmount);

    let currentXVSBalance = ethers.utils.formatEther((await xvs.balanceOf(deployer.address)).toString());

    expect(Number(previousXVSBalance)).to.be.lt(Number(currentXVSBalance));

    await mine(500);

    previousXVSBalance = currentXVSBalance;

    await xvsVault.executeWithdrawal(xvs.address, poolId);

    currentXVSBalance = ethers.utils.formatEther((await xvs.balanceOf(deployer.address)).toString());

    expect(Number(previousXVSBalance)).to.be.lt(Number(currentXVSBalance));
  });

  it("no reward for pending withdrawals", async () => {
    const depositAmount = bigNumber18.mul(100);

    await xvs.approve(xvsVault.address, depositAmount);
    await xvsVault.deposit(xvs.address, poolId, depositAmount);

    const previousXVSBalance = ethers.utils.formatEther((await xvs.balanceOf(deployer.address)).toString());

    await xvsVault.requestWithdrawal(xvs.address, poolId, depositAmount);

    const currentXVSBalance = ethers.utils.formatEther((await xvs.balanceOf(deployer.address)).toString());

    expect(Number(previousXVSBalance) + 1).to.be.equal(Number(currentXVSBalance));
  });

  it("handle pre-upgrade withdrawal requests", async () => {
    const depositAmount = bigNumber18.mul(100);

    await xvs.approve(xvsVault.address, depositAmount);
    await xvsVault.deposit(xvs.address, poolId, depositAmount);

    let previousXVSBalance = ethers.utils.formatEther((await xvs.balanceOf(deployer.address)).toString());

    await mine(1000);
    await xvsVault.requestOldWithdrawal(xvs.address, poolId, depositAmount);

    let currentXVSBalance = ethers.utils.formatEther((await xvs.balanceOf(deployer.address)).toString());

    expect(Number(previousXVSBalance)).to.be.equal(Number(currentXVSBalance));

    previousXVSBalance = currentXVSBalance;

    await mine(500);
    await xvsVault.executeWithdrawal(xvs.address, poolId);

    currentXVSBalance = ethers.utils.formatEther((await xvs.balanceOf(deployer.address)).toString());
    expect(Number(previousXVSBalance)).to.be.lt(Number(currentXVSBalance));
  });

  it("handle pre-upgrade and post-upgrade withdrawal requests", async () => {
    const depositAmount = bigNumber18.mul(100);

    await xvs.approve(xvsVault.address, depositAmount);
    await xvsVault.deposit(xvs.address, poolId, depositAmount);

    let previousXVSBalance = ethers.utils.formatEther((await xvs.balanceOf(deployer.address)).toString());

    await mine(1000);
    await xvsVault.requestOldWithdrawal(xvs.address, poolId, bigNumber18.mul(50));
    await expect(xvsVault.requestWithdrawal(xvs.address, poolId, bigNumber18.mul(50))).to.be.revertedWith(
      "execute existing withdrawal before requesting new withdrawal",
    );

    await mine(500);
    await xvsVault.executeWithdrawal(xvs.address, poolId);
    let currentXVSBalance = ethers.utils.formatEther((await xvs.balanceOf(deployer.address)).toString());

    expect(Number(previousXVSBalance)).to.be.lt(Number(currentXVSBalance));

    previousXVSBalance = currentXVSBalance;

    await mine(500);
    xvsVault.requestWithdrawal(xvs.address, poolId, bigNumber18.mul(50));

    currentXVSBalance = ethers.utils.formatEther((await xvs.balanceOf(deployer.address)).toString());

    await mine(500);
    await xvsVault.executeWithdrawal(xvs.address, poolId);

    currentXVSBalance = ethers.utils.formatEther((await xvs.balanceOf(deployer.address)).toString());
    expect(Number(previousXVSBalance)).to.be.lt(Number(currentXVSBalance));
  });
});

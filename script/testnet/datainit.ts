
import dotenv from 'dotenv';
import fs from 'fs';
import ethers,{Contract,BigNumber,utils,Signer,providers,Wallet,constants} from 'ethers';

import ComptrollerArtifact from '../../artifacts/contracts/Comptroller/Comptroller.sol/Comptroller.json';
import {Comptroller} from '../../typechain/contracts/Comptroller';
import VBep20Artifact from '../../artifacts/contracts/Tokens/VTokens/VBep20.sol/VBep20.json';
import { VBep20 } from '../../typechain/contracts/Tokens/VTokens/VBep20';
import VBNBArtifact from '../../artifacts/contracts/Tokens/VTokens/VBNB.sol/VBNB.json';
import { VBNB } from '../../typechain/contracts/Tokens/VTokens/VBNB';
import SimplePriceOracleArtifact from '../../artifacts/contracts/test/SimplePriceOracle.sol/SimplePriceOracle.json';
import { SimplePriceOracle } from '../../typechain/contracts/test/SimplePriceOracle';

import MockTokenArtifact from '../../artifacts/contracts/test/MockToken.sol/MockToken.json';
import {MockToken} from '../../typechain/contracts/test/MockToken';
import { waitForDebugger } from 'inspector';


const envConfig = dotenv.parse(fs.readFileSync('../../.env'))

async function main() {

  // const provider = new providers.JsonRpcProvider("https://ropsten.infura.io/v3/9aa3d95b3bc440fa88ea12eaa4456161");
  const provider = new providers.JsonRpcProvider("https://bsc-testnet.public.blastapi.io");
  
  const abi = new utils.AbiCoder();
  const admin = new Wallet(envConfig.ADMIN_PRIVATE_KEY,provider);
  const lender = new Wallet(envConfig.LENDER_PRIVATE_KEY,provider);
  const lenderAddress = await lender.getAddress();

  const comptroller = new Contract('0xc6C6117609E45c6B92db6942f7f98b77eCda46A8', ComptrollerArtifact.abi, admin) as Comptroller;
  const  oracle = new Contract('0x32678C693bEFb6eBF76F0132af9453d9242BDD85', SimplePriceOracleArtifact.abi, admin) as SimplePriceOracle;

  const vBnbAddress = '0xb55fA0EF06d73ecA3A579341EfDc07f0808a1067';
  const vBNB = new Contract(vBnbAddress, VBNBArtifact.abi, lender) as VBNB;

  const xvs = new Contract('0xDC3300D23cEA69078aC3b0D6EEB106a2C36e0805', MockTokenArtifact.abi, admin) as MockToken;
  
  const dai = new Contract('0x785e3f3379f02cfAA3bBB7504333A1E00da85E9e', MockTokenArtifact.abi, admin) as MockToken;
  const aave = new Contract('0x34bF95ab803329343Fb3e945c33e02e18293990a', MockTokenArtifact.abi, admin) as MockToken;
  const usdt = new Contract('0x18Ff7cBd6e8333C62537c727307De45A922B36F5', MockTokenArtifact.abi, admin) as MockToken;


  const vbep20Markets:string[] = [
    "0x5E5f75aA74014759937a6C9d7BD7C7DEAE371625",//vXVS
    "0x96506a6F2c4cDA773c552d9b10d8740e59AE54db",//vETH
    "0x249B5B6e907E78E78266230c5d65BCE1c0ce8841",//vUSDC
    "0x8f07A18A114f29E34957b134e0260005b6bc003C",//vDAI
    "0x63E9a53BF7AD8eA8E047c3F7b5C48A6e69ab5109",//vAAVE
    "0x34fDB933b94d393A98149B831600c7Bb635e7382",//vUSDT   
  ]

  const underlyings:string[] = [
    '0xCDB2022A0732ba75cF2aC44A3652393Cd67aCC04',//xvs
    '0xDC3300D23cEA69078aC3b0D6EEB106a2C36e0805',//eth
    '0x08D92102145be9D9f64Ee49ed1B26C688a9C27D3',//usdc
    '0x785e3f3379f02cfAA3bBB7504333A1E00da85E9e',//dai
    '0x34bF95ab803329343Fb3e945c33e02e18293990a',//aave
    '0x18Ff7cBd6e8333C62537c727307De45A922B36F5',//usdt
  ];

  const collateralFactors:BigNumber[] = [
    BigNumber.from("600000000000000000"),
    BigNumber.from(10).pow(17).mul(8),
    BigNumber.from(10).pow(17).mul(8),
    BigNumber.from("600000000000000000"),
    BigNumber.from("550000000000000000"),
    BigNumber.from(10).pow(17).mul(8),
  ]
  let tx;

  console.log("_supportMarket...")
  for(let i=0;i<underlyings.length;i++){
    const underlyingAddress = underlyings[i];
    console.log("support market ",underlyingAddress);
    const mockToken = new Contract(underlyingAddress, MockTokenArtifact.abi, admin) as MockToken;
    if(underlyingAddress!="0xCDB2022A0732ba75cF2aC44A3652393Cd67aCC04"){
        // tx = await mockToken.mint(lender.address, utils.parseEther("1100000"));
        tx = await mockToken.transfer(lenderAddress,utils.parseEther("1100000"));
        await tx.wait();
    }else{//xvs
        tx = await mockToken.transfer(lenderAddress,utils.parseEther("1000000"));
        await tx.wait();
    }
    
    tx = await mockToken.approve(vbep20Markets[i], constants.MaxUint256);
    await tx.wait();
    tx = await mockToken.connect(lender).approve(vbep20Markets[i], constants.MaxUint256);
    await tx.wait();
    tx = await comptroller._supportMarket(vbep20Markets[i]);
    await tx.wait();
    tx = await comptroller._setCollateralFactor(vbep20Markets[i],collateralFactors[i]);
    await tx.wait();
    // setprice
    tx = await oracle.setUnderlyingPrice(vbep20Markets[i], BigNumber.from(10).pow(18));
    await tx.wait();
  }

  tx = await comptroller._supportMarket(vBnbAddress);
    await tx.wait();
  tx = await comptroller._setCollateralFactor(vBnbAddress,BigNumber.from("600000000000000000"));
  await tx.wait();

  console.log("_setVenusSpeeds...")
  const venusSpeeds:BigNumber[] = [
    BigNumber.from(0),
    BigNumber.from(6510416666666667),
    BigNumber.from(5425347222222222),
    BigNumber.from(651041666666667),
    BigNumber.from(217013888888889),
    BigNumber.from(5425347222222222),
  ]
  tx = await comptroller._setVenusSpeeds(vbep20Markets,venusSpeeds,venusSpeeds);
  await tx.wait();

  tx = await comptroller._setVenusSpeeds([vBnbAddress],[BigNumber.from("13020833333333333")],[BigNumber.from("13020833333333333")]);
  await tx.wait();

  console.log("_setMarketBorrowCaps...")
  const borrowCaps:BigNumber[] = [
    BigNumber.from("1"),
    BigNumber.from("2874000000000000000000000"),
    BigNumber.from("124700000000000000000000000"),
    BigNumber.from("7041000000000000000000000"),
    BigNumber.from("1000000000000000000000000"),
    BigNumber.from("245500000000000000000000000"),
  ]
  tx = await comptroller._setMarketBorrowCaps(vbep20Markets,borrowCaps);
  await tx.wait();
  tx = await comptroller._setMarketBorrowCaps([vBnbAddress],[BigNumber.from("2008000000000000000000000")]);
  await tx.wait();

  console.log("_setMarketSupplyCaps...")
  const supplyCaps:BigNumber[] = [
    BigNumber.from("1311000000000000000000000"),
    BigNumber.from("2223000000000000000000000"),
    BigNumber.from("258000000000000000000000000"),
    BigNumber.from("13910000000000000000000000"),
    BigNumber.from("3000000000000000000000000"),
    BigNumber.from("736300000000000000000000000"),
  ]

  tx = await comptroller._setMarketSupplyCaps(vbep20Markets,supplyCaps);
  await tx.wait();
  tx = await comptroller._setMarketSupplyCaps([vBnbAddress],[BigNumber.from("2672000000000000000000000")]);
  await tx.wait();

  //supply
  console.log("Supply...")
  for(let i=1;i<vbep20Markets.length;i++){
    const vAddress = vbep20Markets[i];
    const vBepToken = new Contract(vAddress, VBep20Artifact.abi, lender) as VBep20;
    tx = await vBepToken.mint(utils.parseEther("1000000"));
    await tx.wait();

    tx = await comptroller.connect(lender).enterMarkets([vAddress]);
    await tx.wait();

    console.log("vToken: %s supplybalance: %s",vAddress, (await vBepToken.balanceOfUnderlying(lenderAddress)).toString());
    }

  //borrow
  //exclude xvs
  console.log("Borrow...")
  for(let i=1;i<vbep20Markets.length;i++){
    const vAddress = vbep20Markets[i];
    const vBepToken = new Contract(vAddress, VBep20Artifact.abi, lender) as VBep20;
    
    tx = await vBepToken.borrow(utils.parseEther("500000"));
    await tx.wait();
    console.log("vToken: %s borrow: %s",vAddress, (await vBepToken.borrowBalanceStored(lenderAddress)).toString())
  }

  //repay
  //exclude xvs
  console.log("Repay....")
  for(let i=1;i<vbep20Markets.length;i++){
    const vAddress = vbep20Markets[i];
    const vBepToken = new Contract(vAddress, VBep20Artifact.abi, lender) as VBep20;

    tx = await vBepToken.repayBorrow(constants.MaxUint256);
    await tx.wait();
    console.log("vToken: %s repay: %s borrowBalance: %s",vAddress, utils.parseEther("500000").toString(), (await vBepToken.borrowBalanceStored(lenderAddress)).toString())
  }


  //withdraw
  console.log("Withdraw...")
  for(let i=0;i<vbep20Markets.length;i++){
    const vAddress = vbep20Markets[i];  
    const vBepToken = new Contract(vAddress, VBep20Artifact.abi, lender) as VBep20;
    const underlying = new Contract(await vBepToken.underlying(), MockTokenArtifact.abi, lender) as MockToken;
    const beforeRedeemBalance = await underlying.balanceOf(lenderAddress);
    tx = await vBepToken.redeemUnderlying(utils.parseEther("1000000"));
    await tx.wait();
    const afeterRedeemBalance = await underlying.balanceOf(lenderAddress);
    console.log("vToken: %s, redeem: %s", vAddress, afeterRedeemBalance.sub(beforeRedeemBalance).toString())
  }

  //Liquidation
  console.log("Liquidate...")
  tx = await vBNB.connect(admin).mint({value:utils.parseEther("0.05")});
  await tx.wait();

  tx = await comptroller.enterMarkets([vBnbAddress]);
  await tx.wait();

  const usdc = new Contract('0x08D92102145be9D9f64Ee49ed1B26C688a9C27D3', MockTokenArtifact.abi, admin) as MockToken;
  const vUsdc = new Contract('0x249B5B6e907E78E78266230c5d65BCE1c0ce8841', VBep20Artifact.abi, admin) as VBep20;
  tx = await vUsdc.borrow(utils.parseEther("0.02"));
  await tx.wait();
  console.log("user admin borrowBalance:",(await vUsdc.borrowBalanceStored(await admin.getAddress())).toString());
  tx = await oracle.setUnderlyingPrice(vUsdc.address,utils.parseEther("2"));
  await tx.wait();

  tx = await vUsdc.connect(lender).liquidateBorrow(await admin.getAddress(),utils.parseEther("0.01"),vBnbAddress);
  await tx.wait();
  console.log("user admin borrowBalance after liquidate:",(await vUsdc.borrowBalanceStored(await admin.getAddress())).toString());  

  tx = await oracle.setUnderlyingPrice(vUsdc.address,utils.parseEther("1"));
  await tx.wait();

    //supply
    //exclude xvs
  console.log("Supply for morpho test...")
  for(let i=1;i<vbep20Markets.length;i++){
    const vAddress = vbep20Markets[i];
    const vBepToken = new Contract(vAddress, VBep20Artifact.abi, lender) as VBep20;
    tx = await vBepToken.mint(utils.parseEther("1000000"));
    await tx.wait();

    tx = await comptroller.connect(lender).enterMarkets([vAddress]);
    await tx.wait();

    console.log("vToken: %s supplybalance: %s",vAddress, (await vBepToken.balanceOfUnderlying(lenderAddress)).toString());
    }

  //borrow
  //exclude xvs
  console.log("Borrow for morpho test...")
  for(let i=1;i<vbep20Markets.length;i++){
    const vAddress = vbep20Markets[i];
    const vBepToken = new Contract(vAddress, VBep20Artifact.abi, lender) as VBep20;
    
    tx = await vBepToken.borrow(utils.parseEther("500000"));
    await tx.wait();
    console.log("vToken: %s borrow: %s",vAddress, (await vBepToken.borrowBalanceStored(lenderAddress)).toString())
  }

  console.log("vBNB supply/borrow for morpho test...")
  tx = await vBNB.connect(admin).mint({value:utils.parseEther("0.9")});
  await tx.wait();

  tx = await vBNB.connect(lender).borrow(utils.parseEther("0.3"));
  await tx.wait();

  console.log("Lending pool init success...");
}


// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

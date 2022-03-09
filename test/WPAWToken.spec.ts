import { ethers, upgrades } from "hardhat";
import chai from "chai";
import { solidity } from "ethereum-waffle";
import { WPAWToken } from '../artifacts/typechain/WPAWToken';
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber, Signature } from "ethers";
import ReceiptsUtil from "./ReceiptsUtil";

chai.use(solidity);
const { expect } = chai;

describe('WPAWToken', () => {
	let token: WPAWToken;
	let owner: SignerWithAddress;
	let user1: SignerWithAddress;

  beforeEach(async () => {
		const signers = await ethers.getSigners();
		[owner, user1] = signers;

		const wPAWTokenFactory = await ethers.getContractFactory(
      "WPAWToken",
      signers[0]
    );
		token = (await upgrades.deployProxy(wPAWTokenFactory)) as WPAWToken;
		await token.deployed();

		expect(token.address).to.properAddress;
	});

	describe('Swaps: PAW -> wPAW', () => {

		it('Refuses to mint if the parameters do not match the receipt', async () => {
			const wPawToMint = ethers.utils.parseEther("123");
			const user1_interaction = token.connect(user1);
			const uuid = BigNumber.from(await user1.getTransactionCount());

			const sig: Signature = await ReceiptsUtil.createReceipt(owner, user1.address, wPawToMint, uuid);

			await expect(user1_interaction.mintWithReceipt(user1.address, ethers.utils.parseEther("1"), uuid, sig.v, sig.r, sig.s))
				.to.be.revertedWith("Signature invalid");
			await expect(user1_interaction.mintWithReceipt(owner.address, wPawToMint, uuid, sig.v, sig.r, sig.s))
				.to.be.revertedWith("Signature invalid");
			await expect(user1_interaction.mintWithReceipt(user1.address, wPawToMint, BigNumber.from(12345678), sig.v, sig.r, sig.s))
				.to.be.revertedWith("Signature invalid");
		});

		it('Refuses to mint if the receipt was not signed by the owner', async () => {
			const wPawToMint = ethers.utils.parseEther("123");
			const user1_interaction = token.connect(user1);
			const uuid = BigNumber.from(await user1.getTransactionCount());

			const sig: Signature = await ReceiptsUtil.createReceipt(user1, user1.address, wPawToMint, uuid);

			await expect(user1_interaction.mintWithReceipt(user1.address, wPawToMint, uuid, sig.v, sig.r, sig.s))
				.to.be.revertedWith("Signature invalid");
		});

		it('Refuses to mint if the smart-contract is paused', async () => {
			const wPawToMint = ethers.utils.parseEther("123");
			const user1_interaction = token.connect(user1);
			const uuid = BigNumber.from(await user1.getTransactionCount());

			await token.pause();

			const sig: Signature = await ReceiptsUtil.createReceipt(owner, user1.address, wPawToMint, uuid);
			await expect(user1_interaction.mintWithReceipt(user1.address, wPawToMint, uuid, sig.v, sig.r, sig.s))
				.to.be.revertedWith("BEP20Pausable: transfer paused");
		});

		it('Mints wPAW if the receipt matches parameters', async () => {
			const wPawToMint = ethers.utils.parseEther("123");
			const user1_interaction = token.connect(user1);
			const uuid = BigNumber.from(await user1.getTransactionCount());

			const sig: Signature = await ReceiptsUtil.createReceipt(owner, user1.address, wPawToMint, uuid);
			await expect(user1_interaction.mintWithReceipt(user1.address, wPawToMint, uuid, sig.v, sig.r, sig.s))
				.to.emit(token, 'Transfer')
				.withArgs("0x0000000000000000000000000000000000000000", user1.address, wPawToMint);

			// make sure user was sent his wPAW
			expect(await token.balanceOf(user1.address)).to.equal(wPawToMint);
			// make sure total supply was changed
			expect(await token.totalSupply()).to.equal(wPawToMint);
		});

	});

	describe('Swaps: wPAW -> PAW', () => {

		it('Refuses to swap if user has NOT enough wPAW', async () => {
			// mint some wPAW, first
			const wPawToMint = ethers.utils.parseEther("123");
			const user1_interaction = token.connect(user1);
			const uuid = BigNumber.from(await user1.getTransactionCount());

			const sig: Signature = await ReceiptsUtil.createReceipt(owner, user1.address, wPawToMint, uuid);
			await expect(user1_interaction.mintWithReceipt(user1.address, wPawToMint, uuid, sig.v, sig.r, sig.s))
				.to.emit(token, 'Transfer')
				.withArgs("0x0000000000000000000000000000000000000000", user1.address, wPawToMint);
			expect(await token.balanceOf(user1.address)).to.equal(wPawToMint);

			// now ask to swap back to PAW
			await expect(user1_interaction.swapToPaw("paw_1o3k8868n6d1679iz6fcz1wwwaq9hek4ykd58wsj5bozb8gkf38pm7njrr1o", ethers.utils.parseEther("300")))
				.to.be.revertedWith("Insufficient wPAW");
			expect(await token.balanceOf(user1.address)).to.equal(wPawToMint);
		});

		it('Refuses to swap if PAW address is invalid', async () => {
			// mint some wPAW, first
			const wPawToMint = ethers.utils.parseEther("123");
			const user1_interaction = token.connect(user1);
			const uuid = BigNumber.from(await user1.getTransactionCount());

			const sig: Signature = await ReceiptsUtil.createReceipt(owner, user1.address, wPawToMint, uuid);
			await expect(user1_interaction.mintWithReceipt(user1.address, wPawToMint, uuid, sig.v, sig.r, sig.s))
				.to.emit(token, 'Transfer')
				.withArgs("0x0000000000000000000000000000000000000000", user1.address, wPawToMint);
			expect(await token.balanceOf(user1.address)).to.equal(wPawToMint);

			// now ask to swap back to PAW
			await expect(user1_interaction.swapToPaw("paw_whatever_wrong", wPawToMint))
				.to.be.revertedWith("Not a Paw address");
			expect(await token.balanceOf(user1.address)).to.equal(wPawToMint);
		});

		it('Swaps if user has enough wPAW', async () => {
			// mint some wPAW, first
			const wPawToMint = ethers.utils.parseEther("123");
			const user1_interaction = token.connect(user1);
			const uuid = BigNumber.from(await user1.getTransactionCount());

			const sig: Signature = await ReceiptsUtil.createReceipt(owner, user1.address, wPawToMint, uuid);
			await expect(user1_interaction.mintWithReceipt(user1.address, wPawToMint, uuid, sig.v, sig.r, sig.s))
				.to.emit(token, 'Transfer')
				.withArgs("0x0000000000000000000000000000000000000000", user1.address, wPawToMint);
			expect(await token.balanceOf(user1.address)).to.equal(wPawToMint);

			// now ask to swap back to PAW
			await expect(user1_interaction.swapToPaw("paw_1o3k8868n6d1679iz6fcz1wwwaq9hek4ykd58wsj5bozb8gkf38pm7njrr1o", wPawToMint))
				.to.emit(token, 'Transfer').withArgs(user1.address, '0x0000000000000000000000000000000000000000', wPawToMint)
				.to.emit(token, 'SwapToPaw').withArgs(user1.address, "paw_1o3k8868n6d1679iz6fcz1wwwaq9hek4ykd58wsj5bozb8gkf38pm7njrr1o", wPawToMint);
			expect(await token.balanceOf(user1.address)).to.equal(0);
		});

	});

});

import {
    mConStr0,
    stringToHex,
    MeshTxBuilder,
    PlutusScript,
    applyParamsToScript,
} from "@meshsdk/core";
import { MeshAdapter } from "./mesh";

export class Contract extends MeshAdapter {
    lockAsset = async ({
        datum,
        unit,
        quantity,
    }: {
        datum: string;
        unit: string;
        quantity: string;
    }): Promise<string> => {
        const { utxos, walletAddress } = await this.getWalletForTx();

        const scriptAddress = this.getScriptAddress();

        const txBuilder = new MeshTxBuilder({
            fetcher: this.fetcher,
            verbose: true,
        });

        const unsignedTx = await txBuilder
            .txOut(scriptAddress, [{ unit, quantity }])
            .txOutInlineDatumValue(mConStr0([stringToHex(datum)]))
            .changeAddress(walletAddress)
            .selectUtxosFrom(utxos)
            .complete();

        const signedTx = await this.wallet.signTx(unsignedTx);
        const txHash = await this.wallet.submitTx(signedTx);
        return txHash;
    };

    unlockAsset = async ({
        txHash,
        redeemer,
    }: {
        txHash: string;
        redeemer: string;
    }): Promise<string> => {
        const { utxos, walletAddress, collateral } = await this.getWalletForTx();

        const selectedUtxo = await this.fetcher.fetchUTxOs(txHash);
        if (selectedUtxo.length === 0) throw new Error("UTxO not found");

        const scriptAddress = this.getScriptAddress();

        const txBuilder = new MeshTxBuilder({
            fetcher: this.fetcher,
            verbose: true,
        });

        const unsignedTx = await txBuilder
            .spendingPlutusScriptV3()
            .txIn(
                selectedUtxo[0].input.txHash,
                selectedUtxo[0].input.outputIndex,
                selectedUtxo[0].output.amount,
                scriptAddress
            )
            .txInInlineDatumPresent()
            .txInRedeemerValue(mConStr0([stringToHex(redeemer)]))
            .txInScript(this.contractSpendCompileCode)
            .changeAddress(walletAddress)
            .selectUtxosFrom(utxos)
            .txInCollateral(collateral[0].input.txHash, collateral[0].input.outputIndex, collateral[0].output.amount, collateral[0].output.address)
            .complete();

        const signedTx = await this.wallet.signTx(unsignedTx);
        const txHashResult = await this.wallet.submitTx(signedTx);
        return txHashResult;
    };

    burnAsset = async ({
        txHash,
    }: {
        txHash: string;
    }): Promise<string> => {
        const { utxos, walletAddress, collateral } = await this.getWalletForTx();

        const selectedUtxo = await this.fetcher.fetchUTxOs(txHash);
        if (selectedUtxo.length === 0) throw new Error("UTxO not found");

        const scriptAddress = this.getScriptAddress();

        const txBuilder = new MeshTxBuilder({
            fetcher: this.fetcher,
            verbose: true,
        });

        const unsignedTx = await txBuilder
            .spendingPlutusScriptV3()
            .txIn(
                selectedUtxo[0].input.txHash,
                selectedUtxo[0].input.outputIndex,
                selectedUtxo[0].output.amount,
                scriptAddress
            )
            .txInInlineDatumPresent()
            .txInRedeemerValue(mConStr0([stringToHex("2")])) // action 2 for burn
            .txInScript(this.contractSpendCompileCode)
            .changeAddress(walletAddress)
            .selectUtxosFrom(utxos)
            .txInCollateral(collateral[0].input.txHash, collateral[0].input.outputIndex, collateral[0].output.amount, collateral[0].output.address)
            .complete();

        const signedTx = await this.wallet.signTx(unsignedTx);
        const txHashResult = await this.wallet.submitTx(signedTx);
        return txHashResult;
    };

    relockAsset = async ({
        txHash,
        newDatum,
    }: {
        txHash: string;
        newDatum: string;
    }): Promise<string> => {
        const { utxos, walletAddress, collateral } = await this.getWalletForTx();

        const selectedUtxo = await this.fetcher.fetchUTxOs(txHash);
        if (selectedUtxo.length === 0) throw new Error("UTxO not found");

        const scriptAddress = this.getScriptAddress();

        const txBuilder = new MeshTxBuilder({
            fetcher: this.fetcher,
            verbose: true,
        });

        const unsignedTx = await txBuilder
            .spendingPlutusScriptV3()
            .txIn(
                selectedUtxo[0].input.txHash,
                selectedUtxo[0].input.outputIndex,
                selectedUtxo[0].output.amount,
                scriptAddress
            )
            .txInInlineDatumPresent()
            .txInRedeemerValue(mConStr0([stringToHex("3")])) // action 3 for relock
            .txInScript(this.contractSpendCompileCode)
            .txOut(scriptAddress, selectedUtxo[0].output.amount)
            .txOutInlineDatumValue(mConStr0([stringToHex(newDatum)]))
            .changeAddress(walletAddress)
            .selectUtxosFrom(utxos)
            .txInCollateral(collateral[0].input.txHash, collateral[0].input.outputIndex, collateral[0].output.amount, collateral[0].output.address)
            .complete();

        const signedTx = await this.wallet.signTx(unsignedTx);
        const txHashResult = await this.wallet.submitTx(signedTx);
        return txHashResult;
    };

    // Thêm các phương thức khác cho tạo ticket, burn, marketplace nếu cần
}
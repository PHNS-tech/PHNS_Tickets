import {
    mConStr0,
    stringToHex,
    MeshTxBuilder,
    PlutusScript,
    applyParamsToScript,
    serializePlutusScript,
    deserializeAddress,
} from "@meshsdk/core";
import { MeshAdapter } from "./mesh";

export class Contract extends MeshAdapter {
    lockAsset = async ({
        datum,
        seller,
        status,
        unit,
        quantity,
    }: {
        datum?: string;
        seller?: string;
        status?: string;
        unit: string;
        quantity: string;
    }): Promise<string> => {
        const { utxos, walletAddress } = await this.getWalletForTx();

        const scriptAddress = this.getScriptAddress();

        const txBuilder = new MeshTxBuilder({
            fetcher: this.fetcher,
            verbose: true,
        });

        // Build datum according to ticket_marketplace Datum: constructor 0 [seller: bytes, status: int]
        let datumValue: any;
        if (seller) {
            const statusInt = status ? parseInt(status, 10) : 0;
            datumValue = mConStr0([seller, statusInt]);
        } else if (datum) {
            datumValue = mConStr0([stringToHex(datum)]);
        } else {
            datumValue = mConStr0([deserializeAddress(walletAddress).pubKeyHash, 0]);
        }
        const unsignedTx = await txBuilder
            .txOut(scriptAddress, [{ unit, quantity }])
            .txOutInlineDatumValue(datumValue)
            .changeAddress(walletAddress)
            .selectUtxosFrom(utxos)
            .setNetwork("preprod")
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
        let { utxos, walletAddress, collateral } = await this.getWalletForTx();

        // Try multiple times to fetch the script UTxO (in case of propagation delay)
        const maxRetries = 5;
        const retryDelayMs = 2000;
        let selectedUtxo: any | null = null;
        for (let i = 0; i < maxRetries; i++) {
            const fetchedUtxos = await this.fetcher.fetchUTxOs(txHash).catch(() => []);
            if (fetchedUtxos && fetchedUtxos.length > 0) {
                selectedUtxo = fetchedUtxos[0];
                break;
            }
            if (i < maxRetries - 1) await new Promise((r) => setTimeout(r, retryDelayMs));
        }
        if (!selectedUtxo) throw new Error("UTxO not found for given txHash after retries");

        console.log("Selected UTxO:", JSON.stringify(selectedUtxo, null, 2));

        // Refresh wallet UTxOs/collateral after script UTxO is visible
        const refreshed = await this.getWalletForTx();
        utxos = refreshed.utxos;
        walletAddress = refreshed.walletAddress;
        collateral = refreshed.collateral;
        const scriptCbor = applyParamsToScript(this.contractSpendCompileCode, []);
        const script: PlutusScript = { code: scriptCbor, version: "V3" };
        const scriptAddress = serializePlutusScript(script).address;

        if (!collateral || collateral.length === 0) throw new Error("No collateral available in wallet. Add collateral UTxO to wallet before unlocking.");

        const signerHash = deserializeAddress(walletAddress).pubKeyHash;

        const txBuilder = new MeshTxBuilder({
            fetcher: this.fetcher,
            submitter: this.fetcher,
            verbose: true,
        });

        // Build redeemer: constructor 0 [action: int, buyer: bytes]
        // Parse redeemer as "action,buyerHex" or default to action=0, buyer=signerHash
        let redeemerValue: any;
        if (redeemer.includes(',')) {
            const [actionStr, buyerHex] = redeemer.split(',');
            const action = parseInt(actionStr, 10);
            redeemerValue = mConStr0([action, buyerHex]);
        } else {
            // Default: action=0 (buy?), buyer=wallet pubKeyHash
            redeemerValue = mConStr0([0, signerHash]);
        }

        try {
            const unsignedTx = await txBuilder
                .spendingPlutusScriptV3()
                .txIn(
                    selectedUtxo.input.txHash,
                    selectedUtxo.input.outputIndex,
                    selectedUtxo.output.amount,
                    scriptAddress
                )
                .txInScript(scriptCbor)
                .txInRedeemerValue(redeemerValue)
                .txInInlineDatumPresent()
                .requiredSignerHash(signerHash)
                .changeAddress(walletAddress)
                .txInCollateral(
                    collateral[0].input.txHash,
                    collateral[0].input.outputIndex,
                    collateral[0].output.amount,
                    collateral[0].output.address
                )
                .selectUtxosFrom(utxos)
                .setNetwork("preprod")
                .complete();
            const signedTx = await this.wallet.signTx(unsignedTx).catch((e) => { throw new Error(`Signing failed: ${String(e)}`); });
            const txHashResult = await this.wallet.submitTx(signedTx).catch((e) => { throw new Error(`Submit failed: ${String(e)}`); });
            return txHashResult;
        } catch (err: any) {
            throw new Error(`Failed to build/sign/submit unlock tx: ${err?.message || String(err)}`);
        }
    };

    // Thêm các phương thức khác cho tạo ticket, marketplace nếu cần
}
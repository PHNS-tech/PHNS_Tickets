import {
    mConStr0,
    stringToHex,
    MeshTxBuilder,
    PlutusScript,
    applyParamsToScript,
    serializePlutusScript,
    deserializeAddress,
    deserializeDatum,
    createAddress,
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

        // Deserialize datum to get seller and status
        const datumCbor = selectedUtxo.output.plutusData;
        if (!datumCbor) throw new Error("Datum not found in script UTxO");
        const datumObj = deserializeDatum(datumCbor);
        console.log("Deserialized datum:", datumObj);
        const seller = datumObj.fields[0].bytes;
        const status = datumObj.fields[1].int;

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

        // Build redeemer: constructor 0 [action: int, buyer: bytes]
        // Parse redeemer as "action,buyerHex" or default to action=0, buyer=signerHash
        let action: number;
        let buyer: string;
        if (redeemer.includes(',')) {
            const [actionStr, buyerHex] = redeemer.split(',');
            action = parseInt(actionStr, 10);
            buyer = buyerHex;
        } else {
            // Default: action=0 (buy?), buyer=wallet pubKeyHash
            action = 0;
            buyer = signerHash;
        }
        const redeemerValue = mConStr0([action, buyer]);

        try {
            const txBuilder = new MeshTxBuilder({
                fetcher: this.fetcher,
                submitter: this.fetcher,
                verbose: true,
            });

            // Build tx based on action
            if (action === 0) {
                // Buy: create output to buyer with status=1, and payment to seller
                const buyerAddress = walletAddress; // for test, use same wallet
                const sellerAddress = walletAddress;
                const newDatum = mConStr0([seller, 1]); // status = 1 (sold)
                const quantity = selectedUtxo.output.amount.find(a => a.unit === "lovelace")?.quantity || "0";

                await txBuilder
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
                    .txOut(buyerAddress, selectedUtxo.output.amount) // send ticket to buyer
                    .txOutInlineDatumValue(newDatum) // with status=1
                    .txOut(sellerAddress, [{ unit: "lovelace", quantity }]) // send payment to seller
                    .requiredSignerHash(signerHash)
                    .changeAddress(walletAddress)
                    .txInCollateral(
                        collateral[0].input.txHash,
                        collateral[0].input.outputIndex,
                        collateral[0].output.amount,
                        collateral[0].output.address
                    )
                    .selectUtxosFrom(utxos)
                    .setNetwork("preprod");
            } else if (action === 1) {
                // Cancel: just consume the UTxO, return to seller
                const sellerAddress = walletAddress;

                await txBuilder
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
                    .txOut(sellerAddress, selectedUtxo.output.amount) // return to seller
                    .txOutInlineDatumValue(mConStr0([seller, status])) // keep same datum
                    .requiredSignerHash(signerHash)
                    .changeAddress(walletAddress)
                    .txInCollateral(
                        collateral[0].input.txHash,
                        collateral[0].input.outputIndex,
                        collateral[0].output.amount,
                        collateral[0].output.address
                    )
                    .selectUtxosFrom(utxos)
                    .setNetwork("preprod");
            } else {
                throw new Error("Invalid action");
            }

            const unsignedTx = await txBuilder.complete();
            const signedTx = await this.wallet.signTx(unsignedTx).catch((e) => { throw new Error(`Signing failed: ${String(e)}`); });
            const txHashResult = await this.wallet.submitTx(signedTx).catch((e) => { throw new Error(`Submit failed: ${String(e)}`); });
            return txHashResult;
        } catch (err: any) {
            throw new Error(`Failed to build/sign/submit unlock tx: ${err?.message || String(err)}`);
        }
    };

    // Thêm các phương thức khác cho tạo ticket, marketplace nếu cần
}
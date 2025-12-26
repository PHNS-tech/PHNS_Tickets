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
        unit,
        quantity,
    }: {
        txHash: string;
        redeemer: string;
        unit?: string;
        quantity?: string;
    }): Promise<string> => {
        let { utxos, walletAddress, collateral } = await this.getWalletForTx();

        // Try multiple times to fetch the script UTxO (in case of propagation delay)
        const maxRetries = 1;
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

        // If wallet has no pre-selected collateral, attempt to find a pure-ADA UTxO
        // in `utxos` to use as a fallback collateral. This helps when running
        // with a programmatic wallet (mnemonic) where collateral may not be
        // preconfigured by a browser extension.
        if (!collateral || collateral.length === 0) {
            const candidate = utxos.find((u: any) => {
                const amounts = u.output.amount || [];
                if (amounts.length !== 1) return false;
                const a = amounts[0];
                return a.unit === "lovelace" && BigInt(a.quantity) >= BigInt(2000000);
            });
            if (candidate) {
                collateral = [candidate];
                console.log("Using fallback collateral UTxO:", JSON.stringify(candidate, null, 2));
            } else {
                console.log("No collateral found — attempting to create a fallback collateral UTxO (2 ADA) by sending to self.");
                try {
                    const createBuilder = new MeshTxBuilder({ fetcher: this.fetcher, submitter: this.fetcher, verbose: true });
                    const createTx = await createBuilder
                        .txOut(walletAddress, [{ unit: "lovelace", quantity: "2000000" }])
                        .changeAddress(walletAddress)
                        .selectUtxosFrom(utxos)
                        .setNetwork("preprod")
                        .complete();
                    const signedCreate = await this.wallet.signTx(createTx);
                    const createHash = await this.wallet.submitTx(signedCreate);
                    console.log("Submitted collateral creation tx:", createHash);

                    // Poll wallet UTxOs for the newly created pure-ADA UTxO
                    const maxCreateRetries = 10;
                    const createDelayMs = 2000;
                    let found = false;
                    for (let j = 0; j < maxCreateRetries; j++) {
                        const refreshed2 = await this.getWalletForTx();
                        const newUtxos = refreshed2.utxos;
                        const cand = newUtxos.find((u: any) => {
                            const amounts = u.output.amount || [];
                            if (amounts.length !== 1) return false;
                            const a = amounts[0];
                            return a.unit === "lovelace" && BigInt(a.quantity) >= BigInt(2000000) && u.output.address === walletAddress;
                        });
                        if (cand) {
                            collateral = [cand];
                            utxos = newUtxos;
                            console.log("Found created collateral UTxO:", JSON.stringify(cand, null, 2));
                            found = true;
                            break;
                        }
                        await new Promise((r) => setTimeout(r, createDelayMs));
                    }
                    if (!found) throw new Error("Could not find created collateral UTxO after waiting; please fund wallet or add collateral manually.");
                } catch (e: any) {
                    throw new Error(`No collateral available and failed to create fallback collateral: ${e?.message || String(e)}`);
                }
            }
        }

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
            // Determine asset and quantities for partial purchase
            const amounts = selectedUtxo.output.amount || [];
            const asset = (amounts.find((a: any) => a.unit !== 'lovelace') || {} as any);
            const assetUnit = unit || asset.unit;
            const totalQty = asset && asset.quantity ? BigInt(asset.quantity) : BigInt(1);
            const buyQty = quantity ? BigInt(quantity) : totalQty;
            if (buyQty <= BigInt(0)) throw new Error('Invalid purchase quantity');
            if (buyQty > totalQty) throw new Error('Requested quantity exceeds available amount');

            // Try to parse datum from the selected UTxO so we can re-create a script output with remaining tokens
            let datumValue: any = undefined;
            try {
                const od = selectedUtxo.output?.datum || selectedUtxo.output?.inlineDatum || selectedUtxo.output?.inline_datum;
                if (od && typeof od === 'object') {
                    const hex = od.cbor || (od.fields && od.fields[0] && od.fields[0].bytes) || od;
                    if (typeof hex === 'string') {
                        const hexStr = hex.replace(/^0x/, '');
                        const bytes = (hexStr.match(/.{1,2}/g) || []).map((h: string) => parseInt(h, 16));
                        const s = new TextDecoder().decode(new Uint8Array(bytes));
                        try {
                            const parsed = JSON.parse(s);
                            if (parsed && parsed.seller) {
                                const statusInt = parsed.status ? parseInt(String(parsed.status), 10) : 0;
                                datumValue = mConStr0([parsed.seller, statusInt]);
                            } else {
                                datumValue = mConStr0([stringToHex(s)]);
                            }
                        } catch (e) {
                            datumValue = mConStr0([stringToHex(s)]);
                        }
                    }
                }
            } catch (e) {
                // ignore, we'll proceed without reattaching datum if not available
            }

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
                // send purchased tokens to buyer
                .txOut(walletAddress, assetUnit ? [{ unit: assetUnit, quantity: buyQty.toString() }] : undefined)
                // if remaining tokens exist, return them to the script address (attach original datum if parsed)
                .txOut(
                    scriptAddress,
                    assetUnit && totalQty - buyQty > BigInt(0) ? [{ unit: assetUnit, quantity: (totalQty - buyQty).toString() }] : undefined
                )
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
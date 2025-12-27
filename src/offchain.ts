import {
    mConStr0,
    mConStr1,
    MeshTxBuilder,
    PlutusScript,
    applyParamsToScript,
    serializePlutusScript,
    deserializeAddress,
} from "@meshsdk/core";
import { MeshAdapter } from "./mesh";

export class Contract extends MeshAdapter {
    // Lock asset on script with full total_quantity
    lockAsset = async ({
        seller,
        price,
        policyId,
        assetName,
        status,
        unit,
        quantity,
    }: {
        seller?: string;
        price?: number;
        policyId: string;
        assetName: string;
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

        const sellerAddr = seller || deserializeAddress(walletAddress).pubKeyHash;
        const priceInt = price || 5000000; // default 5 ADA
        const statusInt = status ? parseInt(status, 10) : 0;
        const totalQty = parseInt(quantity, 10);

        console.log("[lockAsset] Creating datum with seller:", sellerAddr, "status:", statusInt);

        // Create datum: [seller, status] - matches smart contract Datum type
        const datumValue = mConStr0([
            sellerAddr,
            statusInt,
        ]);

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

    // Buy tickets: unlock total, keep (total-quantity) locked, send quantity to buyer
    // Single transaction as required: unlock all, lock remaining back, send purchased
    buyTickets = async ({
        txHash,
        quantity,
    }: {
        txHash: string;
        quantity: string;
    }): Promise<string> => {
        let { utxos, walletAddress, collateral } = await this.getWalletForTx();

        // Fetch script UTxO
        const maxRetries = 10;
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
        
        // Validate selectedUtxo structure
        if (!selectedUtxo.input || !selectedUtxo.input.txHash || selectedUtxo.input.outputIndex === undefined) {
            throw new Error("Invalid UTxO input structure");
        }
        if (!selectedUtxo.output || !selectedUtxo.output.amount || !Array.isArray(selectedUtxo.output.amount)) {
            throw new Error("Invalid UTxO output structure: missing or invalid amount array");
        }

        // Refresh wallet
        const refreshed = await this.getWalletForTx();
        utxos = refreshed.utxos;
        walletAddress = refreshed.walletAddress;
        collateral = refreshed.collateral;

        const scriptCbor = applyParamsToScript(this.contractSpendCompileCode, []);
        const script: PlutusScript = { code: scriptCbor, version: "V3" };
        const scriptAddress = serializePlutusScript(script).address;

        // Handle collateral
        if (!collateral || collateral.length === 0) {
            const candidate = utxos.find((u: any) => {
                const amounts = u.output.amount || [];
                if (amounts.length !== 1) return false;
                const a = amounts[0];
                return a.unit === "lovelace" && BigInt(a.quantity) >= BigInt(2000000);
            });

            if (candidate) {
                collateral = [candidate];
            } else {
                const createBuilder = new MeshTxBuilder({
                    fetcher: this.fetcher,
                    submitter: this.fetcher as any,
                    verbose: true,
                });

                const createTx = await createBuilder
                    .txOut(walletAddress, [{ unit: "lovelace", quantity: "2000000" }])
                    .changeAddress(walletAddress)
                    .selectUtxosFrom(utxos)
                    .setNetwork("preprod")
                    .complete();

                const signedCreate = await this.wallet.signTx(createTx);
                const createHash = await this.wallet.submitTx(signedCreate);
                console.log("Collateral creation tx:", createHash);

                // Wait for collateral
                let found = false;
                for (let j = 0; j < maxRetries; j++) {
                    const refreshed2 = await this.getWalletForTx();
                    const cand = refreshed2.utxos.find((u: any) => {
                        const amounts = u.output.amount || [];
                        if (amounts.length !== 1) return false;
                        const a = amounts[0];
                        return a.unit === "lovelace" && BigInt(a.quantity) >= BigInt(2000000);
                    });

                    if (cand) {
                        collateral = [cand];
                        utxos = refreshed2.utxos;
                        found = true;
                        break;
                    }
                    await new Promise((r) => setTimeout(r, retryDelayMs));
                }

                if (!found) {
                    throw new Error(
                        "Could not find created collateral UTxO after waiting"
                    );
                }
            }
        }

        const signerHash = deserializeAddress(walletAddress).pubKeyHash;
        const txBuilder = new MeshTxBuilder({
            fetcher: this.fetcher,
            submitter: this.fetcher as any,
            verbose: true,
        });

        try {
            // Get asset info and quantities
            const amounts = selectedUtxo.output.amount || [];
            console.log("[buyTickets] Amounts:", amounts);
            
            if (!Array.isArray(amounts) || amounts.length === 0) {
                throw new Error("Invalid or empty amounts in UTxO");
            }
            
            const asset =
                amounts.find((a: any) => a.unit !== "lovelace") || ({} as any);
            const assetUnit = asset?.unit;
            if (!assetUnit) throw new Error("No asset found in UTxO");
            const totalQty = asset && asset.quantity ? BigInt(asset.quantity) : BigInt(1);
            const buyQty = BigInt(quantity);

            if (buyQty <= BigInt(0)) throw new Error("Invalid purchase quantity");
            if (buyQty > totalQty) throw new Error("Requested quantity exceeds available");

            const remainingQty = totalQty - buyQty;

            // Parse datum from UTxO
            let datumValue: any = undefined;
            try {
                const od = selectedUtxo.output?.datum ||
                    selectedUtxo.output?.inlineDatum ||
                    selectedUtxo.output?.inline_datum;

                if (od && typeof od === "object") {
                    datumValue = od;
                }
            } catch (e) {
                console.warn("[buyTickets] Failed to read datum from UTxO", e);
                datumValue = undefined;
            }

            // Build redeemer: [action, buyer]
            const redeemerValue = mConStr0([
                0, // action: buy
                signerHash, // buyer
            ]);
            console.log("[buyTickets] Redeemer:", redeemerValue);

            // Build transaction in single operation:
            // 1. Spend script UTxO with redeemer
            // 2. Send purchased quantity to buyer
            // 3. If remaining > 0: lock remaining back to script with same datum
            // 4. Add ADA fee for remaining output if needed

            const unsignedTx = await txBuilder
                .spendingPlutusScriptV3()
                .txIn(
                    selectedUtxo.input.txHash,
                    selectedUtxo.input.outputIndex,
                    amounts, // Use validated amounts instead of selectedUtxo.output.amount
                    scriptAddress
                )
                .txInScript(scriptCbor)
                .txInRedeemerValue(redeemerValue)
                .txInInlineDatumPresent()
                .requiredSignerHash(signerHash)
                // Send purchased tokens to buyer
                .txOut(walletAddress, [
                    { unit: assetUnit, quantity: buyQty.toString() },
                ])
                // If remaining tokens exist, lock them back with same datum
                .txOut(
                    scriptAddress,
                    remainingQty > BigInt(0)
                        ? [{ unit: assetUnit, quantity: remainingQty.toString() }]
                        : [{ unit: "lovelace", quantity: "1000000" }] // Min ADA
                );

            // Attach datum to remaining tokens if exists
            if (datumValue && remainingQty > BigInt(0)) {
                unsignedTx.txOutInlineDatumValue(datumValue);
            }

            if (!collateral || collateral.length === 0) {
                throw new Error("No collateral available for transaction");
            }
            if (!utxos || utxos.length === 0) {
                throw new Error("No UTxOs available for transaction");
            }

            const finalTx = await unsignedTx
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

            const signedTx = await this.wallet.signTx(finalTx);
            const txHashResult = await this.wallet.submitTx(signedTx);
            return txHashResult;
        } catch (err: any) {
            console.error("[buyTickets] Transaction build error:", err);
            throw new Error(`Failed to build/sign/submit buy tx: ${err?.message || String(err)}`);
        }
    };

    // Cancel listing (only seller)
    cancelListing = async (txHash: string): Promise<string> => {
        let { utxos, walletAddress, collateral } = await this.getWalletForTx();

        const maxRetries = 10;
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

        if (!selectedUtxo) throw new Error("UTxO not found for given txHash");

        // Validate selectedUtxo structure
        if (!selectedUtxo.input || !selectedUtxo.input.txHash || selectedUtxo.input.outputIndex === undefined) {
            throw new Error("Invalid UTxO input structure in cancelListing");
        }
        if (!selectedUtxo.output || !selectedUtxo.output.amount || !Array.isArray(selectedUtxo.output.amount)) {
            throw new Error("Invalid UTxO output structure in cancelListing: missing or invalid amount array");
        }

        const refreshed = await this.getWalletForTx();
        utxos = refreshed.utxos;
        walletAddress = refreshed.walletAddress;
        collateral = refreshed.collateral;

        const scriptCbor = applyParamsToScript(this.contractSpendCompileCode, []);
        const script: PlutusScript = { code: scriptCbor, version: "V3" };
        const scriptAddress = serializePlutusScript(script).address;

        if (!collateral || collateral.length === 0) {
            const candidate = utxos.find((u: any) => {
                const amounts = u.output.amount || [];
                if (amounts.length !== 1) return false;
                const a = amounts[0];
                return a.unit === "lovelace" && BigInt(a.quantity) >= BigInt(2000000);
            });

            if (!candidate) {
                throw new Error("No collateral available");
            }
            collateral = [candidate];
        }

        const signerHash = deserializeAddress(walletAddress).pubKeyHash;

        console.log("[cancelListing] Signer hash:", signerHash);
        console.log("[cancelListing] Script address:", scriptAddress);
        console.log("[cancelListing] Selected UTxO input:", selectedUtxo.input);

        const txBuilder = new MeshTxBuilder({
            fetcher: this.fetcher,
            submitter: this.fetcher as any,
            verbose: true,
        });

        // Redeemer: [action, buyer]
        const redeemerValue = mConStr0([
            1, // action: cancel
            signerHash, // buyer (seller in this case)
        ]);
        console.log("[cancelListing] Redeemer:", redeemerValue);

        try {
            const amounts = selectedUtxo.output.amount || [];
            console.log("[cancelListing] Amounts:", amounts);
            
            if (!Array.isArray(amounts) || amounts.length === 0) {
                throw new Error("Invalid or empty amounts in UTxO");
            }
            
            const asset = amounts.find((a: any) => a.unit !== "lovelace") || ({} as any);
            
            if (!asset || !asset.unit || !asset.quantity) {
                throw new Error("Invalid asset in UTxO for cancellation");
            }

            if (!collateral || collateral.length === 0) {
                throw new Error("No collateral available for transaction");
            }
            if (!utxos || utxos.length === 0) {
                throw new Error("No UTxOs available for transaction");
            }

            console.log("[cancelListing] Building transaction with redeemer:", redeemerValue);
            console.log("[cancelListing] Collateral:", collateral[0].input);

            const unsignedTx = await txBuilder
                .spendingPlutusScriptV3()
                .txIn(
                    selectedUtxo.input.txHash,
                    selectedUtxo.input.outputIndex,
                    amounts, // Use validated amounts instead of selectedUtxo.output.amount
                    scriptAddress
                )
                .txInScript(scriptCbor)
                .txInRedeemerValue(redeemerValue)
                .txInInlineDatumPresent()
                .requiredSignerHash(signerHash)
                // Return all tokens to seller
                .txOut(walletAddress, [
                    {
                        unit: asset.unit,
                        quantity: asset.quantity,
                    },
                ])
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

            console.log("[cancelListing] Transaction built successfully");

            const signedTx = await this.wallet.signTx(unsignedTx);
            console.log("[cancelListing] Transaction signed successfully");
            
            const txHashResult = await this.wallet.submitTx(signedTx);
            console.log("[cancelListing] Transaction submitted:", txHashResult);
            return txHashResult;
        } catch (err: any) {
            console.error("[cancelListing] Full error object:", err);
            console.error("[cancelListing] Error message:", err?.message);
            console.error("[cancelListing] Error string:", String(err));
            throw new Error(`Failed to build/sign/submit cancel tx: ${err?.message || String(err)}`);
        }
    };

    // Update price (only seller)
    updatePrice = async (txHash: string, newPrice: number): Promise<string> => {
        let { utxos, walletAddress, collateral } = await this.getWalletForTx();

        const maxRetries = 10;
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

        if (!selectedUtxo) throw new Error("UTxO not found for given txHash");

        // Validate selectedUtxo structure
        if (!selectedUtxo.input || !selectedUtxo.input.txHash || selectedUtxo.input.outputIndex === undefined) {
            throw new Error("Invalid UTxO input structure in updatePrice");
        }
        if (!selectedUtxo.output || !selectedUtxo.output.amount || !Array.isArray(selectedUtxo.output.amount)) {
            throw new Error("Invalid UTxO output structure in updatePrice: missing or invalid amount array");
        }

        const refreshed = await this.getWalletForTx();
        utxos = refreshed.utxos;
        walletAddress = refreshed.walletAddress;
        collateral = refreshed.collateral;

        const scriptCbor = applyParamsToScript(this.contractSpendCompileCode, []);
        const script: PlutusScript = { code: scriptCbor, version: "V3" };
        const scriptAddress = serializePlutusScript(script).address;

        if (!collateral || collateral.length === 0) {
            const candidate = utxos.find((u: any) => {
                const amounts = u.output.amount || [];
                if (amounts.length !== 1) return false;
                const a = amounts[0];
                return a.unit === "lovelace" && BigInt(a.quantity) >= BigInt(2000000);
            });

            if (!candidate) {
                throw new Error("No collateral available");
            }
            collateral = [candidate];
        }

        const signerHash = deserializeAddress(walletAddress).pubKeyHash;

        // Parse datum to update price
        let datumValue: any = undefined;
        try {
            const od = selectedUtxo.output?.datum ||
                selectedUtxo.output?.inlineDatum ||
                selectedUtxo.output?.inline_datum;
            if (od && typeof od === "object") {
                datumValue = od;
            }
        } catch (e) {
            console.warn("[updatePrice] Failed to read datum from UTxO", e);
        }

        const txBuilder = new MeshTxBuilder({
            fetcher: this.fetcher,
            submitter: this.fetcher as any,
            verbose: true,
        });

        // Redeemer: [action, buyer]
        const redeemerValue = mConStr0([
            2, // action: update_price
            signerHash, // buyer (seller in this case)
        ]);
        console.log("[updatePrice] Redeemer:", redeemerValue);

        try {
            const amounts = selectedUtxo.output.amount || [];
            console.log("[updatePrice] Amounts:", amounts);
            
            if (!Array.isArray(amounts) || amounts.length === 0) {
                throw new Error("Invalid or empty amounts in UTxO");
            }

            if (!collateral || collateral.length === 0) {
                throw new Error("No collateral available for transaction");
            }
            if (!utxos || utxos.length === 0) {
                throw new Error("No UTxOs available for transaction");
            }

            const unsignedTx = await txBuilder
                .spendingPlutusScriptV3()
                .txIn(
                    selectedUtxo.input.txHash,
                    selectedUtxo.input.outputIndex,
                    amounts, // Use validated amounts instead of selectedUtxo.output.amount
                    scriptAddress
                )
                .txInScript(scriptCbor)
                .txInRedeemerValue(redeemerValue)
                .txInInlineDatumPresent()
                .requiredSignerHash(signerHash)
                // Return tokens to script with updated datum
                .txOut(scriptAddress, selectedUtxo.output.amount);

            if (datumValue) {
                unsignedTx.txOutInlineDatumValue(datumValue);
            }

            if (!collateral || collateral.length === 0) {
                throw new Error("No collateral available for transaction");
            }
            if (!utxos || utxos.length === 0) {
                throw new Error("No UTxOs available for transaction");
            }

            const finalTx = await unsignedTx
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

            const signedTx = await this.wallet.signTx(finalTx);
            const txHashResult = await this.wallet.submitTx(signedTx);
            return txHashResult;
        } catch (err: any) {
            console.error("Update price error details:", err);
            throw new Error(`Failed to build/sign/submit update price tx: ${err?.message || String(err)}`);
        }
    };

    // Alias for backward compatibility
    buyNFT = (txHash: string, quantity?: string): Promise<string> => {
        return this.buyTickets({
            txHash,
            quantity: quantity || "1",
        });
    };

    unlockAsset = ({
        txHash,
        redeemer,
        unit,
        quantity,
    }: {
        txHash: string;
        redeemer?: string;
        unit?: string;
        quantity?: string;
    }): Promise<string> => {
        const action = redeemer ? parseInt(redeemer, 10) : 1;
        
        if (action === 0) {
            return this.buyTickets({ txHash, quantity: quantity || "1" });
        } else if (action === 1) {
            return this.cancelListing(txHash);
        } else if (action === 2) {
            return this.updatePrice(txHash, 5000000);
        }
        throw new Error("Invalid action");
    };
}

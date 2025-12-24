import {
    applyParamsToScript,
    BlockfrostProvider,
    type IFetcher,
    MeshTxBuilder,
    MeshWallet,
    type Network,
    type PlutusScript,
    serializePlutusScript,
} from "@meshsdk/core";
import blueprint from "../aiken-marketplace/plutus.json";

export class MeshAdapter {
    protected fetcher: IFetcher;
    protected wallet: MeshWallet;
    protected meshTxBuilder: MeshTxBuilder;
    protected network: Network;
    protected networkId: number;

    protected contractSpendCompileCode: string;
    protected contractMintCompileCode: string;

    constructor({
        wallet = null!,
        fetcher = null!,
        blockfrostProvider = null!,
    }: {
        wallet?: MeshWallet;
        fetcher?: IFetcher;
        blockfrostProvider?: BlockfrostProvider;
    }) {
        this.wallet = wallet;
        this.fetcher = blockfrostProvider;
        this.meshTxBuilder = new MeshTxBuilder({
            fetcher: blockfrostProvider,
            evaluator: blockfrostProvider,
        });
        this.network = "preprod";
        this.networkId = 0;

        this.contractSpendCompileCode = blueprint.validators[0].compiledCode;
        this.contractMintCompileCode = blueprint.validators[0].compiledCode; // Điều chỉnh nếu khác
    }

    protected async getWalletForTx() {
        const utxos = await this.wallet.getUtxos();
        const walletAddress = await this.wallet.getChangeAddress();
        const collateral = await this.wallet.getCollateral();
        return { utxos, walletAddress, collateral };
    }

    protected getScriptAddress() {
        const script: PlutusScript = {
            code: applyParamsToScript(this.contractSpendCompileCode, []),
            version: "V3",
        };
        return serializePlutusScript(script, undefined, this.networkId).address;
    }
}
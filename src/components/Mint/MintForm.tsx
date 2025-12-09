"use client";

import { useState } from "react";
import { useWallet } from "@meshsdk/react";
import {
    MeshTxBuilder,
    ForgeScript,
    resolveScriptHash,
    stringToHex,
} from "@meshsdk/core";

export default function MintForm() {
    const [file, setFile] = useState<File>();
    const [uploading, setUploading] = useState(false);
    const [minting, setMinting] = useState(false);
    const [ipfsHash, setIpfsHash] = useState("");
    const [txHash, setTxHash] = useState("");
    const [assetName, setAssetName] = useState("");
    const [assetDescription, setAssetDescription] = useState("");
    const [assetQuantity, setAssetQuantity] = useState(1);

    const { wallet, connected } = useWallet();

    const uploadFile = async () => {
        if (!file) return alert("No file selected");
        try {
            setUploading(true);
            // Get signed upload URL from backend
            const urlRes = await fetch("/api/url").then((res) => res.json());

            // Upload file to Pinata via backend API route (avoids CORS)
            const formData = new FormData();
            formData.append("file", file);
            formData.append("url", urlRes.url);

            const uploadRes = await fetch("/api/upload", {
                method: "POST",
                body: formData,
            }).then((res) => res.json());

            if (uploadRes.cid) {
                setIpfsHash(uploadRes.cid);
                setUploading(false);
                alert("File uploaded!");
            } else {
                throw new Error(uploadRes.error || "Unknown error");
            }
        } catch (e) {
            console.log(e);
            setUploading(false);
            alert("Upload failed");
        }
    };

    const mintAssets = async () => {
        if (!connected || !wallet) return alert("Connect wallet first");
        if (!ipfsHash) return alert("Upload file first");
        if (!assetName.trim()) return alert("Enter asset name");

        try {
            setMinting(true);

            const utxos = await wallet.getUtxos();
            const changeAddress = await wallet.getChangeAddress();
            const forgingScript = ForgeScript.withOneSignature(changeAddress);
            const policyId = resolveScriptHash(forgingScript);
            const tokenName = assetName.replace(/\s+/g, "");
            const tokenNameHex = stringToHex(tokenName);

            const metadata = {
                [policyId]: {
                    [tokenName]: {
                        name: assetName,
                        image: ipfsHash,
                        mediaType: "image/jpg",
                        description: assetDescription,
                    },
                },
            };

            const txBuilder = new MeshTxBuilder({ verbose: true });
            const unsignedTx = await txBuilder
                .mint(assetQuantity.toString(), policyId, tokenNameHex)
                .mintingScript(forgingScript)
                .metadataValue(721, metadata)
                .changeAddress(changeAddress)
                .selectUtxosFrom(utxos)
                .complete();

            const signedTx = await wallet.signTx(unsignedTx);
            const hash = await wallet.submitTx(signedTx);

            setTxHash(hash);
            setMinting(false);
            alert("Minted!");
        } catch (e) {
            console.log(e);
            setMinting(false);
            alert("Mint failed");
        }
    };

    return (
        <div style={{
            display: "flex",
            flexDirection: "column",
            gap: "20px",
            padding: "24px",
            border: "1px solid #ddd",
            borderRadius: "8px",
            width: "100%",
            maxWidth: "400px"
        }}>

            <div>
                <h3>Upload Image</h3>
                <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setFile(e.target.files?.[0])}
                    style={{ width: "100%", padding: "8px", marginBottom: "8px" }}
                />
                <button
                    disabled={uploading || !file}
                    onClick={uploadFile}
                    style={{
                        padding: "8px 16px",
                        backgroundColor: uploading || !file ? "#ccc" : "#007bff",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        width: "100%",
                        cursor: uploading || !file ? "not-allowed" : "pointer"
                    }}
                >
                    {uploading ? "Uploading..." : "Upload"}
                </button>
                {ipfsHash && <p style={{ color: "green", fontSize: "12px" }}>Uploaded: {ipfsHash}</p>}
            </div>

            <div>
                <h3>Asset Details</h3>
                <input
                    type="text"
                    placeholder="Asset Name"
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                    style={{ width: "100%", padding: "8px", marginBottom: "8px", boxSizing: "border-box" }}
                />
                <textarea
                    placeholder="Description"
                    value={assetDescription}
                    onChange={(e) => setAssetDescription(e.target.value)}
                    rows={2}
                    style={{ width: "100%", padding: "8px", marginBottom: "8px", boxSizing: "border-box" }}
                />
                <input
                    type="number"
                    placeholder="Quantity"
                    value={assetQuantity}
                    onChange={(e) => setAssetQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                    min="1"
                    style={{ width: "100%", padding: "8px", boxSizing: "border-box" }}
                />
            </div>

            <div>
                <button
                    disabled={minting || !connected || !ipfsHash || !assetName.trim()}
                    onClick={mintAssets}
                    style={{
                        padding: "12px",
                        backgroundColor: (minting || !connected || !ipfsHash || !assetName.trim()) ? "#ccc" : "#28a745",
                        color: "white",
                        border: "none",
                        borderRadius: "4px",
                        width: "100%",
                        fontSize: "16px",
                        cursor: (minting || !connected || !ipfsHash || !assetName.trim()) ? "not-allowed" : "pointer"
                    }}
                >
                    {minting ? "Minting..." : `Mint ${assetQuantity} Asset${assetQuantity > 1 ? 's' : ''}`}
                </button>

                {!connected && <p style={{ color: "red", fontSize: "12px", textAlign: "center" }}>Connect wallet first</p>}
                {txHash && <p style={{ color: "green", fontSize: "12px", wordBreak: "break-all" }}>Success! TX: {txHash}</p>}
            </div>
        </div>
    );
}

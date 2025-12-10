"use client";

import { useState } from "react";
import { useWallet } from "@meshsdk/react";
import {
  MeshTxBuilder,
  ForgeScript,
  resolveScriptHash,
  stringToHex,
  applyParamsToScript,
  serializePlutusScript,
  mConStr0,
} from "@meshsdk/core";
import blueprint from '../../../plutus.json';

export default function CreateTicket() {
  const [file, setFile] = useState<File>();
  const [uploading, setUploading] = useState(false);
  const [minting, setMinting] = useState(false);
  const [ipfsHash, setIpfsHash] = useState("");
  const [txHash, setTxHash] = useState("");
  const [mintedUnit, setMintedUnit] = useState("");
  const [lockPrice, setLockPrice] = useState('2000000');
  const [assetName, setAssetName] = useState("");
  const [assetDescription, setAssetDescription] = useState("");
  const [assetQuantity, setAssetQuantity] = useState(1);

  const { wallet, connected } = useWallet();

  const uploadFile = async () => {
    if (!file) return alert("No file selected");
    try {
      setUploading(true);
      console.log('1. Requesting signed URL from /api/url');
      const urlRes = await fetch("/api/url");
      console.log('2. Response status:', urlRes.status, 'Content-Type:', urlRes.headers.get('content-type'));

      if (!urlRes.ok) {
        const text = await urlRes.text();
        console.error('API response:', text.substring(0, 500));
        throw new Error(`/api/url failed with status ${urlRes.status}: ${text.substring(0, 200)}`);
      }

      const urlJson = await urlRes.json();
      console.log('3. Got signed URL:', urlJson.url?.substring(0, 50) + '...');

      // Upload file to Pinata via backend API route (avoids CORS)
      const formData = new FormData();
      formData.append("file", file);
      formData.append("url", urlJson.url);

      console.log('4. Uploading file to /api/upload');
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      console.log('5. Upload response status:', uploadRes.status);

      if (!uploadRes.ok) {
        const text = await uploadRes.text();
        console.error('Upload error:', text.substring(0, 500));
        throw new Error(`/api/upload failed: ${text.substring(0, 200)}`);
      }

      const uploadJson = await uploadRes.json();
      console.log('6. Upload complete, CID:', uploadJson.cid);

      if (uploadJson.cid) {
        setIpfsHash(uploadJson.cid);
        setUploading(false);
        alert("File uploaded!");
      } else {
        throw new Error(uploadJson.error || "No CID returned");
      }
    } catch (e) {
      console.error('Upload error:', e);
      setUploading(false);
      alert("Upload failed: " + String(e));
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
      // store minted unit for locking to marketplace
      setMintedUnit(`${policyId}${tokenNameHex}`);
      setMinting(false);
      alert("Ticket created (minted)!");
    } catch (e) {
      console.log(e);
      setMinting(false);
      alert("Mint failed");
    }
  };

  // Lock minted ticket to marketplace script
  const handleLockToMarketplace = async () => {
    if (!connected || !wallet) return alert('Connect wallet first');
    if (!mintedUnit) return alert('No minted ticket to lock');

    try {
      const utxos = await wallet.getUtxos();
      const changeAddress = await wallet.getChangeAddress();

      const Script = applyParamsToScript(blueprint.validators[0].compiledCode, []);
      const { address: scriptAddress } = serializePlutusScript({ code: Script, version: 'V3' });

      const datumObj = { event_id: 'evt1', seller: changeAddress, price: Number(lockPrice), ticket_number: 't1', event_date: 0, status: 0 };
      const datumStr = JSON.stringify(datumObj);

      const txBuilder = new MeshTxBuilder({ verbose: true });
      const unsigned = await txBuilder
        .txOut(scriptAddress, [{ unit: mintedUnit, quantity: assetQuantity.toString() }])
        .txOutInlineDatumValue(mConStr0([stringToHex(datumStr)]))
        .changeAddress(changeAddress)
        .selectUtxosFrom(utxos)
        .complete();

      const signed = await wallet.signTx(unsigned);
      const lockTx = await wallet.submitTx(signed);
      alert('Locked to marketplace! Tx: ' + lockTx);
    } catch (err) {
      console.error(err);
      alert('Lock failed: ' + (err instanceof Error ? err.message : String(err)));
    }
  };

  return (
    <div style={{ maxWidth: 1000, margin: '24px auto', padding: '18px' }}>
      <div style={{ display: 'flex', gap: 20, flexDirection: 'column' }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Create Ticket</div>

        <div style={{ display: 'flex', gap: 20, flexDirection: 'row', flexWrap: 'wrap' }}>
          {/* Left: image + upload */}
          <div style={{ minWidth: 320, maxWidth: 360, flex: '0 0 360px', border: '1px solid #ececec', borderRadius: 12, padding: 12, background: '#fff' }}>
            <div style={{ height: 220, borderRadius: 8, overflow: 'hidden', background: '#fafafa', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              {ipfsHash ? (
                // show image preview from Pinata gateway
                // if your uploads use another gateway change URL accordingly
                <img src={`https://gateway.pinata.cloud/ipfs/${ipfsHash}`} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ color: '#888' }}>No image uploaded</div>
              )}
            </div>

            <label style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>Upload Poster</label>
            <input type="file" accept="image/*" onChange={(e) => setFile(e.target.files?.[0])} style={{ width: '100%', marginBottom: 8 }} />
            <button disabled={uploading || !file} onClick={uploadFile} style={{ width: '100%', padding: 10, background: uploading || !file ? '#ddd' : '#1976d2', color: 'white', border: 'none', borderRadius: 8, cursor: uploading || !file ? 'not-allowed' : 'pointer' }}>{uploading ? 'Uploading...' : 'Upload Poster'}</button>
            {ipfsHash && <div style={{ marginTop: 10, fontSize: 12, color: '#0a8f3e' }}>Uploaded: {ipfsHash}</div>}
          </div>

          {/* Right: details + actions */}
          <div style={{ flex: 1, minWidth: 280, border: '1px solid #ececec', borderRadius: 12, padding: 16, background: '#fff' }}>
            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Event / Ticket Name</label>
              <input type="text" placeholder="Asset Name" value={assetName} onChange={(e) => setAssetName(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', boxSizing: 'border-box' }} />
            </div>

            <div style={{ marginBottom: 12 }}>
              <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Description</label>
              <textarea placeholder="Description" value={assetDescription} onChange={(e) => setAssetDescription(e.target.value)} rows={3} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', boxSizing: 'border-box' }} />
            </div>

            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <div style={{ flex: '1 1 120px' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Quantity</label>
                <input type="number" value={assetQuantity} onChange={(e) => setAssetQuantity(Math.max(1, parseInt(e.target.value) || 1))} min={1} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', boxSizing: 'border-box' }} />
              </div>

              <div style={{ flex: '1 1 160px' }}>
                <label style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>Price (lovelace)</label>
                <input value={lockPrice} onChange={(e) => setLockPrice(e.target.value)} style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #ddd', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12 }}>
              <button disabled={minting || !connected || !ipfsHash || !assetName.trim()} onClick={mintAssets} style={{ flex: 1, padding: 12, background: (minting || !connected || !ipfsHash || !assetName.trim()) ? '#ddd' : '#28a745', color: 'white', border: 'none', borderRadius: 8, cursor: (minting || !connected || !ipfsHash || !assetName.trim()) ? 'not-allowed' : 'pointer' }}>{minting ? 'Minting...' : `Mint ${assetQuantity}`}</button>
              <button disabled={!mintedUnit} onClick={handleLockToMarketplace} style={{ padding: 12, background: mintedUnit ? '#1976d2' : '#ddd', color: 'white', border: 'none', borderRadius: 8, cursor: mintedUnit ? 'pointer' : 'not-allowed' }}>Lock to Marketplace</button>
            </div>

            <div style={{ marginTop: 12 }}>
              {!connected && <p style={{ color: 'crimson' }}>Connect wallet to mint and lock tickets.</p>}
              {txHash && <p style={{ color: '#0a8f3e', wordBreak: 'break-all' }}>Mint TX: {txHash}</p>}
              {mintedUnit && <div style={{ marginTop: 8, fontSize: 13, color: '#333' }}>Minted unit: <code style={{ background: '#f7f7f7', padding: '2px 6px', borderRadius: 4 }}>{mintedUnit}</code></div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
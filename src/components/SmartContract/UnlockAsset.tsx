"use client";

// Import các thư viện cần thiết
import { useState, useEffect } from 'react';
import { useWallet } from '@meshsdk/react';
import {
    applyParamsToScript,
    mConStr0,
    MeshTxBuilder,
    serializePlutusScript,
    stringToHex,
    BlockfrostProvider,
} from '@meshsdk/core';
import blueprint from '../../../plutus.json';

// Create provider for client-side use
const provider = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY || '');

// Hàm lấy UTXO từ transaction hash
async function getUtxoByTxHash(txHash: string) {
    // Gọi provider để tìm UTXO theo hash
    const utxos = await provider.fetchUTxOs(txHash);
    if (utxos.length === 0) {
        throw new Error("UTxO not found");
    }
    return utxos[0];
}

// Hàm gọi API 
async function fetchUtxos(address: string) {
    const response = await fetch('/api/blockfrost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address })
    });
    const result = await response.json();
    return result.success ? result.data : [];
}

export default function UnlockAsset() {
    // Lấy thông tin ví từ hook useWallet
    const { wallet, connected } = useWallet();

    // Các state để quản lý trạng thái component
    const [loading, setLoading] = useState(false);        // Trạng thái đang xử lý
    const [scriptAddress, setScriptAddress] = useState(''); // Địa chỉ smart contract
    const [txHash, setTxHash] = useState('');              // Transaction hash người dùng nhập
    const [redeemer, setRedeemer] = useState('123');       // Redeemer để unlock
    const [result, setResult] = useState('');              // Kết quả thực hiện
    const [utxos, setUtxos] = useState([]);               // Danh sách UTXOs

    // Tạo script từ blueprint
    const Script = applyParamsToScript(blueprint.validators[0].compiledCode, []);

    // useEffect chạy khi component mount để tạo script address
    useEffect(() => {
        // Tạo địa chỉ script từ Plutus script
        const addr = serializePlutusScript({ code: Script, version: "V3" }).address;
        setScriptAddress(addr);
    }, []);

    // Hàm tải danh sách UTXOs từ script address
    const loadUtxos = async () => {
        const data = await fetchUtxos(scriptAddress);
        setUtxos(data);
    };

    // Hàm xử lý unlock UTXO
    const handleUnlock = async () => {
        // Kiểm tra điều kiện cần thiết
        if (!connected || !txHash || !redeemer) {
            setResult('Vui lòng kết nối ví và nhập đầy đủ thông tin');
            return;
        }

        try {
            // Bắt đầu quá trình unlock
            setLoading(true);
            setResult('Đang unlock...');

            // 1. Lấy UTXO cần unlock từ transaction hash
            const selectedUtxo = await getUtxoByTxHash(txHash);

            // 2. Lấy thông tin từ ví
            const walletUtxos = await wallet.getUtxos();           // UTXOs trong ví
            const walletAddress = await wallet.getChangeAddress(); // Địa chỉ ví
            const collateral = await wallet.getCollateral();       // Collateral cho transaction

            // 3. Tạo transaction builder
            const txBuilder = new MeshTxBuilder({ fetcher: provider, verbose: true });

            // 4. Build transaction để unlock UTXO
            await txBuilder
                .spendingPlutusScriptV3()                           // Sử dụng Plutus script V3
                .txIn(                                              // Input UTXO cần unlock
                    selectedUtxo.input.txHash,
                    selectedUtxo.input.outputIndex,
                    selectedUtxo.output.amount,
                    scriptAddress
                )
                .txInScript(Script)                                 // Attach script
                .txInRedeemerValue(mConStr0([stringToHex(redeemer)])) // Redeemer để unlock
                .txInInlineDatumPresent()                          // Sử dụng inline datum
                .changeAddress(walletAddress)                       // Địa chỉ nhận tiền thừa
                .txInCollateral(                                   // Collateral cho script execution
                    collateral[0].input.txHash,
                    collateral[0].input.outputIndex,
                    collateral[0].output.amount,
                    collateral[0].output.address
                )
                .selectUtxosFrom(walletUtxos)                      // Chọn UTXOs từ ví để trả phí
                .complete();                                       // Hoàn thành build transaction

            // 5. Ký transaction
            const signedTx = await wallet.signTx(txBuilder.txHex);

            // 6. Submit transaction lên blockchain
            const txHashResult = await wallet.submitTx(signedTx);

            // 7. Hiển thị kết quả thành công
            setResult(`Thành công! Hash: ${txHashResult}`);

            // 8. Reload danh sách UTXOs để cập nhật
            loadUtxos();

        } catch (err) {
            // Xử lý lỗi
            setResult(`Lỗi: ${err.message}`);
        } finally {
            // Kết thúc quá trình xử lý
            setLoading(false);
        }
    };

    // Render giao diện
    return (
        <div style={{ padding: '20px', border: '1px solid #ccc' }}>
            <h3>Unlock Asset</h3>

            {/* Hiển thị script address */}
            <p>Script: {scriptAddress}</p>

            {/* Button tải UTXOs */}
            <button onClick={loadUtxos}>Tải UTXOs</button>

            {/* Hiển thị danh sách UTXOs nếu có */}
            {utxos.length > 0 && (
                <div style={{ margin: '10px 0', padding: '10px', background: '#f5f5f5' }}>
                    <h4>UTXOs ({utxos.length}):</h4>
                    {utxos.map((utxo, i) => (
                        <div key={i} style={{ margin: '5px 0', padding: '5px', background: 'white' }}>
                            {/* Hiển thị transaction hash */}
                            <div>TX: {utxo.txHash}</div>
                            {/* Hiển thị assets trong UTXO */}
                            <div>Assets: {utxo.assets.map(a => `${a.unit}: ${a.quantity}`).join(', ')}</div>
                            {/* Hiển thị datum trong UTXO */}
                            <div>Datum: {JSON.stringify(utxo.datum)}</div>
                            {/* Button chọn UTXO này */}
                            <button onClick={() => setTxHash(utxo.txHash)}>Chọn</button>
                        </div>
                    ))}
                </div>
            )}

            {/* Input nhập transaction hash */}
            <div>
                <label>Transaction Hash:</label>
                <input
                    value={txHash}
                    onChange={(e) => setTxHash(e.target.value)}
                    style={{ width: '100%', padding: '5px' }}
                />
            </div>

            {/* Input nhập redeemer */}
            <div>
                <label>Redeemer:</label>
                <input
                    value={redeemer}
                    onChange={(e) => setRedeemer(e.target.value)}
                    style={{ width: '100%', padding: '5px' }}
                />
            </div>

            {/* Button unlock */}
            <button
                onClick={handleUnlock}
                disabled={loading || !connected || !txHash || !redeemer}
                style={{
                    width: '100%',
                    padding: '10px',
                    background: loading ? '#ccc' : '#007bff',
                    color: 'white',
                    border: 'none'
                }}
            >
                {loading ? 'Đang xử lý...' : 'Unlock'}
            </button>

            {/* Hiển thị kết quả */}
            {result && <div style={{ margin: '10px 0', padding: '10px', background: '#e7f3ff' }}>{result}</div>}
        </div>
    );
}
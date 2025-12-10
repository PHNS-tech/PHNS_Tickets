// components/home/AssetViewer.tsx
"use client";
import { useState } from 'react';
import { useAssets } from '@meshsdk/react';

export function AssetViewer() {
  const assets = useAssets();
  const [showAssets, setShowAssets] = useState(false);

  return (
    <div>
      <h3>Tài sản trong ví</h3>
      
      {showAssets && assets ? (
        <div>
          <p>Tìm thấy: <strong>{assets.length}</strong> tài sản</p>
          <button 
            onClick={() => setShowAssets(false)}
            style={{
              background: '#dc3545',
              color: 'white',
              border: 'none',
              padding: '8px 15px',
              borderRadius: '5px',
              cursor: 'pointer',
              marginBottom: '10px'
            }}
          >
            Ẩn danh sách
          </button>
          <pre style={{ 
            background: '#f8f9fa',
            color: '#000',
            padding: '10px', 
            fontSize: '12px',
            overflow: 'auto',
            maxHeight: '200px'
          }}>
            {JSON.stringify(assets, null, 2)}
          </pre>
        </div>
      ) : (
        <button 
          onClick={() => setShowAssets(true)}
          style={{
            background: '#007bff',
            color: 'white',
            border: 'none',
            padding: '10px 15px',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Xem tài sản {assets && `(${assets.length})`}
        </button>
      )}
    </div>
  );
}
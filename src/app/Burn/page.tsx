"use client";

import BurnForm from "../../components/Burn/BurnForm";

export default function BurnPage() {
  return (
    <main style={{
      width: '100%',
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '24px',
      padding: '32px'
    }}>
      <h1 style={{ fontSize: '30px', fontWeight: 'bold' }}>
        Burn Your Tokens
      </h1>

      <BurnForm />
    </main>
  );
}
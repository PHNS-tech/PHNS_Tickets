"use client";

import MintForm from "../../components/Mint/MintForm";

export default function MintPage() {
    return (
        <main style={{
            width: "100%",
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "center",
            gap: "24px",
            padding: "32px"
        }}>
            <h1 style={{ fontSize: "30px", fontWeight: "bold" }}>
                Mint Your Assets
            </h1>

            <MintForm />
        </main>
    );
}
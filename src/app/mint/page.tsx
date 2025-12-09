import MintForm from "../../components/Mint/MintForm";

export default function MintPage() {
    return (
        <div style={{ padding: "24px", maxWidth: "600px", margin: "0 auto" }}>
            <h1>Mint NFT with Pinata Upload</h1>
            <MintForm />
        </div>
    );
}

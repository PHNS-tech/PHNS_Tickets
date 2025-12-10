"use client";

import LockAsset from '../../components/SmartContract/LockAsset';
// import UnlockAsset from '../../components/SmartContract/UnlockAsset';

export default function SmartContractPage() {
    return (
        <div className="container mx-auto p-6 max-w-4xl">
            <div className="max-w-2xl mx-auto">
                <LockAsset />
            </div>
            {/* <div className="max-w-2xl mx-auto">
                <UnlockAsset />
            </div> */}
        </div>
    );
}
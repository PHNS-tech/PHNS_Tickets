"use server";

import { BlockfrostProvider } from '@meshsdk/core';

// Expects NEXT_PUBLIC_BLOCKFROST_API_KEY to be set in environment
export const provider = new BlockfrostProvider(process.env.NEXT_PUBLIC_BLOCKFROST_API_KEY || '');

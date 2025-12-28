import { privyClient } from "../tokens/utils";
import type { Transaction, VersionedTransaction } from "@solana/web3.js";

export interface EthSignMessageParams {
  walletId: string;
  message: string;
}

export interface TypedDataDomain {
  name: string;
  version: string;
  chainId: number;
  verifyingContract: string;
  salt?: string;
}

export interface TypedDataType {
  name: string;
  type: string;
}

export interface TypedData {
  domain: TypedDataDomain;
  types: Record<string, TypedDataType[]>;
  primaryType: string;
  message: Record<string, any>;
}

export interface EthSignTypedDataParams {
  walletId: string;
  typedData: TypedData;
}

export interface EthTransactionRequest {
  to: string;
  value: number;
  chainId: number;
  data?: string;
  nonce?: number;
  gasLimit?: number;
  gasPrice?: number;
  maxFeePerGas?: number;
  maxPriorityFeePerGas?: number;
}

export interface EthSignTransactionParams {
  walletId: string;
  transaction: EthTransactionRequest;
}

export interface EthSendTransactionParams {
  walletId: string;
  caip2: string; // Chain identifier in format "eip155:<chainId>"
  transaction: EthTransactionRequest;
}

export interface SolSignMessageParams {
  walletId: string;
  message: string;
}

export interface SolSignTransactionParams {
  walletId: string;
  transaction: VersionedTransaction | Transaction;
}

export interface SolSignAndSendTransactionParams {
  walletId: string;
  caip2: string; // Chain identifier in format "solana:<cluster>"
  transaction: VersionedTransaction | Transaction;
}

/**
 * PrivyServer - A wrapper around @privy-io/server-auth's wallet methods for Ethereum and Solana
 */
export class PrivyServer {
  constructor() {}

  /**
   * Sign a message with an Ethereum wallet
   *
   * @param params - Parameters for signing a message
   * @returns The signature and encoding
   *
   * @example
   * ```typescript
   * const { signature, encoding } = await privyDelegate.signEthMessage({
   *   walletId: 'your-wallet-id',
   *   message: 'Hello world',
   * });
   * ```
   */
  async signEthMessage(params: EthSignMessageParams) {
    const { walletId, message } = params;

    const response = await privyClient.walletApi.ethereum.signMessage({
      message,
      address: walletId,
      chainType: "ethereum",
    });

    return response;
  }

  /**
   * Sign a transaction with an Ethereum wallet without broadcasting it
   *
   * @param params - Parameters for signing a transaction
   * @returns The signed transaction and encoding
   *
   * @example
   * ```typescript
   * const { signedTransaction, encoding } = await privyDelegate.signEthTransaction({
   *   walletId: 'your-wallet-id',
   *   transaction: {
   *     to: '0xE3070d3e4309afA3bC9a6b057685743CF42da77C',
   *     value: 100000,
   *     chainId: 8453,
   *   },
   * });
   * ```
   */
  async signEthTransaction(params: EthSignTransactionParams) {
    const { walletId, transaction } = params;

    const response = await privyClient.walletApi.ethereum.signTransaction({
      transaction,
      address: walletId,
      chainType: "ethereum",
    });

    return response;
  }

  /**
   * Sign and send a transaction with an Ethereum wallet
   *
   * @param params - Parameters for sending a transaction
   * @returns The transaction hash
   *
   * @example
   * ```typescript
   * const { hash } = await privyDelegate.sendEthTransaction({
   *   walletId: 'your-wallet-id',
   *   caip2: 'eip155:8453',
   *   transaction: {
   *     to: '0xE3070d3e4309afA3bC9a6b057685743CF42da77C',
   *     value: 100000,
   *     chainId: 8453,
   *   },
   * });
   * ```
   */
  async sendEthTransaction(params: EthSendTransactionParams) {
    const { walletId, caip2, transaction } = params;

    const response = await privyClient.walletApi.ethereum.sendTransaction({
      caip2,
      transaction,
      address: walletId,
      chainType: "ethereum",
    });

    return response;
  }

  /**
   * Sign a message with a Solana wallet
   *
   * @param params - Parameters for signing a message
   * @returns The signature and encoding
   *
   * @example
   * ```typescript
   * const { signature, encoding } = await privyDelegate.signSolMessage({
   *   walletId: 'your-wallet-id',
   *   message: 'Hello world',
   * });
   * ```
   */
  async signSolMessage(params: SolSignMessageParams) {
    //
    const { walletId, message } = params;

    const response = await privyClient.walletApi.solana.signMessage({
      message,
      address: walletId,
      chainType: "solana",
    });

    return response;
  }

  /**
   * Sign a transaction with a Solana wallet without broadcasting it
   *
   * @param params - Parameters for signing a transaction
   * @returns The signed transaction object
   *
   * @example
   * ```typescript
   * const { signedTransaction } = await privyDelegate.signSolTransaction({
   *   walletId: 'your-wallet-id',
   *   transaction: solanaTransaction, // Transaction | VersionedTransaction from @solana/web3.js
   * });
   * ```
   */
  async signSolTransaction(params: SolSignTransactionParams) {
    const { walletId, transaction } = params;

    const response = await privyClient.walletApi.solana.signTransaction({
      address: walletId,
      chainType: "solana",
      transaction: transaction,
    });

    return response;
  }

  /**
   * Sign and send a transaction with a Solana wallet
   *
   * @param params - Parameters for signing and sending a transaction
   * @returns The transaction hash
   *
   * @example
   * ```typescript
   * const { hash } = await privyDelegate.signAndSendSolTransaction({
   *   walletId: 'your-wallet-id',
   *   caip2: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', // Mainnet
   *   transaction: solanaTransaction, // Transaction | VersionedTransaction from @solana/web3.js
   * });
   * ```
   */
  async signAndSendSolTransaction(params: SolSignAndSendTransactionParams) {
    const { walletId, caip2, transaction } = params;
    const response = await privyClient.walletApi.solana.signAndSendTransaction({
      address: walletId,
      chainType: "solana",
      caip2,
      transaction,
    });
    return response;
  }
}

import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * A StoreKit 2 signed transaction (JWS). The cap is a cheap guard against
 * oversized bodies — real transactions are a few kilobytes, and the signature is
 * verified before any field is trusted.
 */
export class RedeemAppleTransactionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20000)
  signedTransaction!: string;
}

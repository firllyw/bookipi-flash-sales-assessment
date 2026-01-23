import { IsEmail, IsUUID } from 'class-validator';

export class PurchaseDto {
  @IsEmail()
  userId: string;
}

export class PurchaseResponseDto {
  success: boolean;
  message: string;
  orderId?: string;
}

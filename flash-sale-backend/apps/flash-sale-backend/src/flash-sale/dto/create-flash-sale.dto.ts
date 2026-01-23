import { IsString, IsInt, IsDateString, Min, IsUUID } from 'class-validator';

export class CreateFlashSaleDto {
  @IsString()
  productId: string;

  @IsInt()
  @Min(1)
  stock: number;

  @IsDateString()
  startTime: string;

  @IsDateString()
  endTime: string;
}

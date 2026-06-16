import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsInt, IsISO8601, IsString, Max, MaxLength, Min, ValidateNested } from 'class-validator';

export class ReviewItemDto {
  @IsInt() @Type(() => Number)
  cardId!: number;

  @IsInt() @Min(1) @Max(4) @Type(() => Number)
  rating!: number;

  @IsString() @MaxLength(64)
  reviewUid!: string;

  @IsISO8601()
  reviewTime!: string;
}

export class SubmitReviewsDto {
  @IsArray()
  @ArrayMaxSize(1000)
  @ValidateNested({ each: true })
  @Type(() => ReviewItemDto)
  reviews!: ReviewItemDto[];
}

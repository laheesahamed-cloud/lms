export declare class ReviewItemDto {
    cardId: number;
    rating: number;
    reviewUid: string;
    reviewTime: string;
}
export declare class SubmitReviewsDto {
    reviews: ReviewItemDto[];
}

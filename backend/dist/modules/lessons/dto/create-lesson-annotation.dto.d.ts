export declare class CreateLessonAnnotationDto {
    type: 'highlight' | 'note';
    selectedText: string;
    startOffset: number;
    endOffset: number;
    color?: string;
    noteText?: string;
}

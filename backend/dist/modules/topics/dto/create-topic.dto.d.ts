export declare class CreateTopicDto {
    courseId: number;
    topicName: string;
    topicDescription?: string;
    subtopics?: string[];
    status: 'active' | 'inactive';
}

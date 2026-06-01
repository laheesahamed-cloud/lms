export declare class UpsertTheoryRecapDto {
    conceptName?: string;
    hierarchyCourse?: string;
    hierarchySubject?: string;
    hierarchyTopic?: string;
    hierarchyLesson?: string;
    etiology?: string[];
    pathophysiology?: string[];
    clinicalFeatures?: string[];
    investigations?: string[];
    treatment?: string[];
    keyPoints?: string[];
    mnemonic?: string;
    reviewedStatus?: 'pending' | 'approved' | 'rejected';
}

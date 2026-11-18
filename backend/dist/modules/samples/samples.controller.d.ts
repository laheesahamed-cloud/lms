import { SamplesService } from './samples.service';
export declare class SamplesController {
    private readonly samples;
    constructor(samples: SamplesService);
    index(inm: string | undefined, enc: string | undefined, res: any): Promise<void>;
    lesson(id: number, inm: string | undefined, enc: string | undefined, res: any): Promise<void>;
    quiz(id: number, inm: string | undefined, enc: string | undefined, res: any): Promise<void>;
    deck(id: number, inm: string | undefined, enc: string | undefined, res: any): Promise<void>;
    private send;
}

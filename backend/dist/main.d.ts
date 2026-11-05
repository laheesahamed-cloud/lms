import { INestApplication } from '@nestjs/common';
export declare function resolveTrustProxy(raw: string | undefined): boolean | number | string;
export declare function configureApp(app: INestApplication): Promise<void>;
export declare function bootstrap(): Promise<void>;

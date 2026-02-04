declare module 'node-html-to-image' {
    export interface Options {
        html: string;
        output?: string;
        type?: 'jpeg' | 'png';
        quality?: number;
        content?: any;
        waitUntil?: 'load' | 'domcontentloaded' | 'networkidle0' | 'networkidle2';
        transparent?: boolean;
        puppeteerArgs?: any;
        encoding?: 'base64' | 'binary';
        selector?: string;
    }

    export default function nodeHtmlToImage(options: Options): Promise<any>;
}

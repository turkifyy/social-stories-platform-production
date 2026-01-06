declare module 'node-fetch' {
  export default function fetch(url: string | Request, options?: any): Promise<Response>;
  export interface Response {
    ok: boolean;
    status: number;
    statusText: string;
    buffer(): Promise<Buffer>;
    text(): Promise<string>;
    json(): Promise<any>;
  }
  export interface Request {
    url?: string;
    method?: string;
  }
}

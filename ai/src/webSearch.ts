import { AwsClient } from "aws4fetch";

export const MAX_QUERY_CHARS = 200;
const RESULTS_PER_SEARCH = 6;
const PAGE_TIMEOUT_MS = 8000;
// MCP tool names are <gateway target name>___<tool name>.
const TOOL_NAME = "web-search___WebSearch";

export interface WebResult {
  title: string;
  url: string;
  text: string;
  publishedDate?: string;
}

export interface WebClient {
  search(query: string): Promise<WebResult[]>;
  read(url: string): Promise<string>;
}

export interface AgentCoreWebClientOptions {
  gatewayUrl: string;
  credentials: () => Promise<{
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  }>;
  fetch?: typeof fetch;
}

interface AgentCoreResult {
  title?: string;
  url?: string;
  text?: string;
  publishedDate?: string;
}

export class AgentCoreWebClient implements WebClient {
  private readonly fetchImpl: typeof fetch;
  private readonly region: string;

  constructor(private readonly options: AgentCoreWebClientOptions) {
    this.fetchImpl = options.fetch ?? fetch;
    const region = new URL(options.gatewayUrl).hostname.split(".")[3];
    if (!region)
      throw new Error(`Not an AgentCore gateway URL: ${options.gatewayUrl}`);
    this.region = region;
  }

  async search(query: string): Promise<WebResult[]> {
    const aws = new AwsClient({
      ...(await this.options.credentials()),
      service: "bedrock-agentcore",
      region: this.region,
    });
    const request = await aws.sign(this.options.gatewayUrl, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: {
          name: TOOL_NAME,
          arguments: {
            query: query.slice(0, MAX_QUERY_CHARS),
            maxResults: RESULTS_PER_SEARCH,
          },
        },
      }),
    });
    const res = await this.fetchImpl(request);
    if (!res.ok) {
      throw new Error(`Web search failed (${res.status}): ${await res.text()}`);
    }
    const body = (await res.json()) as {
      error?: { message: string };
      result?: {
        isError?: boolean;
        content?: { type: string; text?: string }[];
      };
    };
    const text = body.result?.content?.find((c) => c.type === "text")?.text;
    if (body.error || body.result?.isError || text === undefined) {
      throw new Error(
        `Web search failed: ${body.error?.message ?? text ?? "no result"}`,
      );
    }
    const { results = [] } = JSON.parse(text) as {
      results?: AgentCoreResult[];
    };
    return results.flatMap((r) =>
      r.url && r.text
        ? [
            {
              title: r.title ?? r.url,
              url: r.url,
              text: r.text,
              ...(r.publishedDate && r.publishedDate !== "unknown"
                ? { publishedDate: r.publishedDate }
                : {}),
            },
          ]
        : [],
    );
  }

  async read(url: string): Promise<string> {
    const res = await this.fetchImpl(url, {
      headers: {
        "user-agent": "CirclesPlanner/0.1",
        accept: "text/html, text/plain",
      },
      signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Page read failed (${res.status})`);
    const type = res.headers.get("content-type") ?? "";
    if (!/text\/(html|plain)/.test(type)) {
      throw new Error(`Not a text page (${type || "no content type"})`);
    }
    return pageText(await res.text());
  }
}

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

function pageText(html: string): string {
  return html
    .replace(
      /<(head|script|style|noscript|svg|template|iframe|nav|header|footer|aside|form)\b[\s\S]*?<\/\1\s*>/gi,
      " ",
    )
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(
      /<br\s*\/?>|<\/(p|div|li|h[1-6]|tr|section|article|ul|ol)\s*>/gi,
      "\n",
    )
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
      if (code[0] !== "#") return ENTITIES[code.toLowerCase()] ?? whole;
      const n =
        code[1] === "x" || code[1] === "X"
          ? parseInt(code.slice(2), 16)
          : Number(code.slice(1));
      return Number.isFinite(n) && n > 0 && n <= 0x10ffff
        ? String.fromCodePoint(n)
        : whole;
    })
    .replace(/[^\S\n]+/g, " ")
    .replace(/ *\n[\s]*/g, "\n")
    .trim();
}

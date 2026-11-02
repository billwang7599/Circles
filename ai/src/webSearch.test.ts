import { describe, expect, test } from "vitest";
import { AgentCoreWebClient, MAX_QUERY_CHARS } from "./webSearch.ts";

const GATEWAY =
  "https://circles-web-search-abc123.gateway.bedrock-agentcore.us-east-1.amazonaws.com/mcp";
const credentials = async () => ({
  accessKeyId: "AKIDEXAMPLE",
  secretAccessKey: "secret",
  sessionToken: "token",
});

function mockFetch(respond: () => Response) {
  const calls: Request[] = [];
  const fn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push(new Request(input, init));
    return respond();
  }) as typeof fetch;
  return { fn, calls };
}

const toolResult = (results: unknown[], isError = false) =>
  Response.json({
    jsonrpc: "2.0",
    id: 1,
    result: {
      isError,
      content: [{ type: "text", text: JSON.stringify({ id: "x", results }) }],
    },
  });

const client = (f: typeof fetch) =>
  new AgentCoreWebClient({ gatewayUrl: GATEWAY, credentials, fetch: f });

describe("AgentCoreWebClient.search", () => {
  test("calls the gateway's WebSearch tool, signed for bedrock-agentcore in the gateway's region", async () => {
    const { fn, calls } = mockFetch(() => toolResult([]));
    await client(fn).search("best ramen uptown waterloo");
    const req = calls[0]!;
    expect(req.url).toBe(GATEWAY);
    expect(req.method).toBe("POST");
    expect(req.headers.get("authorization")).toMatch(
      /^AWS4-HMAC-SHA256 Credential=AKIDEXAMPLE\/\d{8}\/us-east-1\/bedrock-agentcore\/aws4_request/,
    );
    expect(req.headers.get("x-amz-security-token")).toBe("token");
    const body = await req.json();
    expect(body).toMatchObject({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: "web-search___WebSearch",
        arguments: { query: "best ramen uptown waterloo" },
      },
    });
  });

  test("cuts the query to the length AgentCore accepts", async () => {
    const { fn, calls } = mockFetch(() => toolResult([]));
    await client(fn).search("x".repeat(MAX_QUERY_CHARS + 50));
    const body = await calls[0]!.json();
    expect(body.params.arguments.query).toHaveLength(MAX_QUERY_CHARS);
  });

  test("returns title, url, snippet and a known publish date", async () => {
    const { fn } = mockFetch(() =>
      toolResult([
        {
          title: "Best ramen in KW",
          url: "https://example.com/ramen",
          text: "Try Ajisen.",
          publishedDate: "2026-09-25",
        },
        {
          title: "Old list",
          url: "https://example.com/old",
          text: "Ramen spots.",
          publishedDate: "unknown",
        },
        { text: "no url, nothing to cite" },
      ]),
    );
    expect(await client(fn).search("ramen")).toEqual([
      {
        title: "Best ramen in KW",
        url: "https://example.com/ramen",
        text: "Try Ajisen.",
        publishedDate: "2026-09-25",
      },
      {
        title: "Old list",
        url: "https://example.com/old",
        text: "Ramen spots.",
      },
    ]);
  });

  test("throws on an HTTP error, a JSON-RPC error or a tool error", async () => {
    await expect(
      client(
        mockFetch(() => new Response("denied", { status: 403 })).fn,
      ).search("q"),
    ).rejects.toThrow(/403/);
    await expect(
      client(
        mockFetch(() =>
          Response.json({
            jsonrpc: "2.0",
            id: 1,
            error: { code: -32600, message: "bad version" },
          }),
        ).fn,
      ).search("q"),
    ).rejects.toThrow(/bad version/);
    await expect(
      client(mockFetch(() => toolResult([], true)).fn).search("q"),
    ).rejects.toThrow();
  });
});

describe("AgentCoreWebClient.read", () => {
  const page = (
    body: string,
    type = "text/html; charset=utf-8",
    status = 200,
  ) =>
    mockFetch(
      () => new Response(body, { status, headers: { "content-type": type } }),
    );

  test("fetches the page with a plain unsigned GET and returns its visible text", async () => {
    const { fn, calls } =
      page(`<html><head><title>T</title><style>p{}</style></head>
      <body><nav>Home | About</nav><script>var x = 1;</script>
      <h1>Hidden gems</h1><p>Try <b>Ajisen</b> &amp; Kinkaku&#39;s rolls&nbsp;&#x2014; cheap.</p>
      <footer>Copyright</footer></body></html>`);
    const text = await client(fn).read("https://blog.example.com/gems");
    expect(calls[0]!.method).toBe("GET");
    expect(calls[0]!.headers.get("authorization")).toBeNull();
    expect(text).toContain("Hidden gems");
    expect(text).toContain("Try Ajisen & Kinkaku's rolls \u2014 cheap.");
    expect(text).not.toMatch(/var x|p\{\}|Home \| About|Copyright|<|>/);
  });

  test("throws on an error status or a page that is not text", async () => {
    await expect(
      client(page("nope", "text/html", 404).fn).read("https://a.com"),
    ).rejects.toThrow(/404/);
    await expect(
      client(page("%PDF", "application/pdf").fn).read("https://a.com"),
    ).rejects.toThrow();
  });
});

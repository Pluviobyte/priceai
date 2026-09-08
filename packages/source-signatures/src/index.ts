import type { CollectorKind } from "@price-radar/schema";

export interface SourceObservation {
  url: URL;
  html?: string;
  successfulPaths?: string[];
}

export interface SignatureMatch {
  collectorKind: CollectorKind;
  confidence: number;
  evidence: string[];
}

interface Signature {
  collectorKind: CollectorKind;
  paths: string[];
  htmlPatterns: RegExp[];
}

const signatures: Signature[] = [
  {
    collectorKind: "shop_api",
    paths: [
      "/shopApi/Shop/info",
      "/shopApi/Shop/categoryList",
      "/shopApi/Shop/goodsList",
      "/shopApi/Shop/goodsInfo",
    ],
    htmlPatterns: [/shopApi\/Shop\//i, /goods_key/i, /shop_token/i],
  },
  {
    collectorKind: "shop_api_16688",
    paths: ["/shopApi/shop/detail", "/shopApi/goods/list"],
    htmlPatterns: [/16688\.oss-accelerate\.aliyuncs\.com/i, /shopApi\/goods\/list/i],
  },
  {
    collectorKind: "kami",
    paths: ["/user/api/index/commodity"],
    htmlPatterns: [/user\/api\/index\/commodity/i, /异次元|kami/i],
  },
  {
    collectorKind: "dujiao",
    paths: ["/api/v1/public/products"],
    htmlPatterns: [/api\/v1\/public\/products/i, /独角数卡|dujiao/i],
  },
];

export function matchSourceSignatures(
  observation: SourceObservation,
): SignatureMatch[] {
  const html = observation.html ?? "";
  const successfulPaths = new Set(observation.successfulPaths ?? []);

  return signatures
    .map((signature): SignatureMatch | null => {
      const pathMatches = signature.paths.filter((path) => successfulPaths.has(path));
      const htmlMatches = signature.htmlPatterns.filter((pattern) => pattern.test(html));
      if (pathMatches.length === 0 && htmlMatches.length === 0) return null;

      const confidence = Math.min(
        1,
        0.35 + pathMatches.length * 0.25 + htmlMatches.length * 0.1,
      );

      return {
        collectorKind: signature.collectorKind,
        confidence,
        evidence: [
          ...pathMatches.map((path) => `path:${path}`),
          ...htmlMatches.map((pattern) => `html:${pattern.source}`),
        ],
      };
    })
    .filter((match): match is SignatureMatch => match !== null)
    .sort((left, right) => right.confidence - left.confidence);
}


export * from "./platforms.js";

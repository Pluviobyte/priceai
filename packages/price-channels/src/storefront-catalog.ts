/**
 * Apple App Store 公开商店目录。币种来自 Apple 财务报告地区表：44 个独立币种地区，
 * 其余商店按欧元区（EUR）、拉美加勒比（USD）、南亚太平洋（USD）与其他地区（USD）归组；
 * 同时出现在独立行与分组里的地区以独立行为准。
 * 来源：https://developer.apple.com/help/app-store-connect/reference/financial-report-regions-and-currencies
 * 目录只描述商店与币种，不含价格；价格必须来自带证据与核验时间的采集记录。
 */
export type AppleStorefrontRegionGroup =
  | "individual"
  | "euro_zone"
  | "latin_america_caribbean"
  | "south_asia_pacific"
  | "rest_of_world";

export interface AppleStorefrontCatalogItem {
  countryCode: string;
  storefront: string;
  currency: string;
  region: AppleStorefrontRegionGroup;
}

export const APPLE_STOREFRONT_CATALOG: readonly AppleStorefrontCatalogItem[] = [
  { countryCode: "AE", storefront: "ae", currency: "AED", region: "individual" },
  { countryCode: "AF", storefront: "af", currency: "USD", region: "rest_of_world" },
  { countryCode: "AG", storefront: "ag", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "AI", storefront: "ai", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "AL", storefront: "al", currency: "USD", region: "rest_of_world" },
  { countryCode: "AM", storefront: "am", currency: "USD", region: "rest_of_world" },
  { countryCode: "AO", storefront: "ao", currency: "USD", region: "rest_of_world" },
  { countryCode: "AR", storefront: "ar", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "AT", storefront: "at", currency: "EUR", region: "euro_zone" },
  { countryCode: "AU", storefront: "au", currency: "AUD", region: "individual" },
  { countryCode: "AZ", storefront: "az", currency: "USD", region: "rest_of_world" },
  { countryCode: "BA", storefront: "ba", currency: "EUR", region: "euro_zone" },
  { countryCode: "BB", storefront: "bb", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "BE", storefront: "be", currency: "EUR", region: "euro_zone" },
  { countryCode: "BF", storefront: "bf", currency: "USD", region: "rest_of_world" },
  { countryCode: "BG", storefront: "bg", currency: "EUR", region: "individual" },
  { countryCode: "BH", storefront: "bh", currency: "USD", region: "rest_of_world" },
  { countryCode: "BJ", storefront: "bj", currency: "USD", region: "rest_of_world" },
  { countryCode: "BM", storefront: "bm", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "BN", storefront: "bn", currency: "USD", region: "south_asia_pacific" },
  { countryCode: "BO", storefront: "bo", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "BR", storefront: "br", currency: "BRL", region: "individual" },
  { countryCode: "BS", storefront: "bs", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "BT", storefront: "bt", currency: "USD", region: "south_asia_pacific" },
  { countryCode: "BW", storefront: "bw", currency: "USD", region: "rest_of_world" },
  { countryCode: "BY", storefront: "by", currency: "USD", region: "rest_of_world" },
  { countryCode: "BZ", storefront: "bz", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "CA", storefront: "ca", currency: "CAD", region: "individual" },
  { countryCode: "CD", storefront: "cd", currency: "USD", region: "rest_of_world" },
  { countryCode: "CG", storefront: "cg", currency: "USD", region: "rest_of_world" },
  { countryCode: "CH", storefront: "ch", currency: "CHF", region: "individual" },
  { countryCode: "CI", storefront: "ci", currency: "USD", region: "rest_of_world" },
  { countryCode: "CL", storefront: "cl", currency: "CLP", region: "individual" },
  { countryCode: "CM", storefront: "cm", currency: "USD", region: "rest_of_world" },
  { countryCode: "CN", storefront: "cn", currency: "CNY", region: "individual" },
  { countryCode: "CO", storefront: "co", currency: "COP", region: "individual" },
  { countryCode: "CR", storefront: "cr", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "CV", storefront: "cv", currency: "USD", region: "rest_of_world" },
  { countryCode: "CY", storefront: "cy", currency: "EUR", region: "euro_zone" },
  { countryCode: "CZ", storefront: "cz", currency: "CZK", region: "individual" },
  { countryCode: "DE", storefront: "de", currency: "EUR", region: "euro_zone" },
  { countryCode: "DK", storefront: "dk", currency: "DKK", region: "individual" },
  { countryCode: "DM", storefront: "dm", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "DO", storefront: "do", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "DZ", storefront: "dz", currency: "USD", region: "rest_of_world" },
  { countryCode: "EC", storefront: "ec", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "EE", storefront: "ee", currency: "EUR", region: "euro_zone" },
  { countryCode: "EG", storefront: "eg", currency: "EGP", region: "individual" },
  { countryCode: "ES", storefront: "es", currency: "EUR", region: "euro_zone" },
  { countryCode: "FI", storefront: "fi", currency: "EUR", region: "euro_zone" },
  { countryCode: "FJ", storefront: "fj", currency: "USD", region: "south_asia_pacific" },
  { countryCode: "FM", storefront: "fm", currency: "USD", region: "south_asia_pacific" },
  { countryCode: "FR", storefront: "fr", currency: "EUR", region: "euro_zone" },
  { countryCode: "GA", storefront: "ga", currency: "USD", region: "rest_of_world" },
  { countryCode: "GB", storefront: "gb", currency: "GBP", region: "individual" },
  { countryCode: "GD", storefront: "gd", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "GE", storefront: "ge", currency: "USD", region: "rest_of_world" },
  { countryCode: "GH", storefront: "gh", currency: "USD", region: "rest_of_world" },
  { countryCode: "GM", storefront: "gm", currency: "USD", region: "rest_of_world" },
  { countryCode: "GR", storefront: "gr", currency: "EUR", region: "euro_zone" },
  { countryCode: "GT", storefront: "gt", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "GW", storefront: "gw", currency: "USD", region: "rest_of_world" },
  { countryCode: "GY", storefront: "gy", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "HK", storefront: "hk", currency: "HKD", region: "individual" },
  { countryCode: "HN", storefront: "hn", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "HR", storefront: "hr", currency: "EUR", region: "individual" },
  { countryCode: "HU", storefront: "hu", currency: "HUF", region: "individual" },
  { countryCode: "ID", storefront: "id", currency: "IDR", region: "individual" },
  { countryCode: "IE", storefront: "ie", currency: "EUR", region: "euro_zone" },
  { countryCode: "IL", storefront: "il", currency: "ILS", region: "individual" },
  { countryCode: "IN", storefront: "in", currency: "INR", region: "individual" },
  { countryCode: "IQ", storefront: "iq", currency: "USD", region: "rest_of_world" },
  { countryCode: "IS", storefront: "is", currency: "USD", region: "rest_of_world" },
  { countryCode: "IT", storefront: "it", currency: "EUR", region: "euro_zone" },
  { countryCode: "JM", storefront: "jm", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "JO", storefront: "jo", currency: "USD", region: "rest_of_world" },
  { countryCode: "JP", storefront: "jp", currency: "JPY", region: "individual" },
  { countryCode: "KE", storefront: "ke", currency: "USD", region: "rest_of_world" },
  { countryCode: "KG", storefront: "kg", currency: "USD", region: "rest_of_world" },
  { countryCode: "KH", storefront: "kh", currency: "USD", region: "south_asia_pacific" },
  { countryCode: "KN", storefront: "kn", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "KR", storefront: "kr", currency: "KRW", region: "individual" },
  { countryCode: "KW", storefront: "kw", currency: "USD", region: "rest_of_world" },
  { countryCode: "KY", storefront: "ky", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "KZ", storefront: "kz", currency: "KZT", region: "individual" },
  { countryCode: "LA", storefront: "la", currency: "USD", region: "south_asia_pacific" },
  { countryCode: "LB", storefront: "lb", currency: "USD", region: "rest_of_world" },
  { countryCode: "LC", storefront: "lc", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "LK", storefront: "lk", currency: "USD", region: "south_asia_pacific" },
  { countryCode: "LR", storefront: "lr", currency: "USD", region: "rest_of_world" },
  { countryCode: "LT", storefront: "lt", currency: "EUR", region: "euro_zone" },
  { countryCode: "LU", storefront: "lu", currency: "EUR", region: "euro_zone" },
  { countryCode: "LV", storefront: "lv", currency: "EUR", region: "euro_zone" },
  { countryCode: "LY", storefront: "ly", currency: "USD", region: "rest_of_world" },
  { countryCode: "MA", storefront: "ma", currency: "USD", region: "rest_of_world" },
  { countryCode: "MD", storefront: "md", currency: "USD", region: "rest_of_world" },
  { countryCode: "ME", storefront: "me", currency: "EUR", region: "euro_zone" },
  { countryCode: "MG", storefront: "mg", currency: "USD", region: "rest_of_world" },
  { countryCode: "MK", storefront: "mk", currency: "USD", region: "rest_of_world" },
  { countryCode: "ML", storefront: "ml", currency: "USD", region: "rest_of_world" },
  { countryCode: "MM", storefront: "mm", currency: "USD", region: "south_asia_pacific" },
  { countryCode: "MN", storefront: "mn", currency: "USD", region: "south_asia_pacific" },
  { countryCode: "MO", storefront: "mo", currency: "USD", region: "south_asia_pacific" },
  { countryCode: "MR", storefront: "mr", currency: "USD", region: "rest_of_world" },
  { countryCode: "MS", storefront: "ms", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "MT", storefront: "mt", currency: "EUR", region: "euro_zone" },
  { countryCode: "MU", storefront: "mu", currency: "USD", region: "rest_of_world" },
  { countryCode: "MV", storefront: "mv", currency: "USD", region: "south_asia_pacific" },
  { countryCode: "MW", storefront: "mw", currency: "USD", region: "rest_of_world" },
  { countryCode: "MX", storefront: "mx", currency: "MXN", region: "individual" },
  { countryCode: "MY", storefront: "my", currency: "MYR", region: "individual" },
  { countryCode: "MZ", storefront: "mz", currency: "USD", region: "rest_of_world" },
  { countryCode: "NA", storefront: "na", currency: "USD", region: "rest_of_world" },
  { countryCode: "NE", storefront: "ne", currency: "USD", region: "rest_of_world" },
  { countryCode: "NG", storefront: "ng", currency: "NGN", region: "individual" },
  { countryCode: "NI", storefront: "ni", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "NL", storefront: "nl", currency: "EUR", region: "euro_zone" },
  { countryCode: "NO", storefront: "no", currency: "NOK", region: "individual" },
  { countryCode: "NP", storefront: "np", currency: "USD", region: "south_asia_pacific" },
  { countryCode: "NR", storefront: "nr", currency: "USD", region: "south_asia_pacific" },
  { countryCode: "NZ", storefront: "nz", currency: "NZD", region: "individual" },
  { countryCode: "OM", storefront: "om", currency: "USD", region: "rest_of_world" },
  { countryCode: "PA", storefront: "pa", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "PE", storefront: "pe", currency: "PEN", region: "individual" },
  { countryCode: "PG", storefront: "pg", currency: "USD", region: "south_asia_pacific" },
  { countryCode: "PH", storefront: "ph", currency: "PHP", region: "individual" },
  { countryCode: "PK", storefront: "pk", currency: "PKR", region: "individual" },
  { countryCode: "PL", storefront: "pl", currency: "PLN", region: "individual" },
  { countryCode: "PT", storefront: "pt", currency: "EUR", region: "euro_zone" },
  { countryCode: "PW", storefront: "pw", currency: "USD", region: "south_asia_pacific" },
  { countryCode: "PY", storefront: "py", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "QA", storefront: "qa", currency: "QAR", region: "individual" },
  { countryCode: "RO", storefront: "ro", currency: "RON", region: "individual" },
  { countryCode: "RS", storefront: "rs", currency: "EUR", region: "euro_zone" },
  { countryCode: "RU", storefront: "ru", currency: "RUB", region: "individual" },
  { countryCode: "RW", storefront: "rw", currency: "USD", region: "rest_of_world" },
  { countryCode: "SA", storefront: "sa", currency: "SAR", region: "individual" },
  { countryCode: "SB", storefront: "sb", currency: "USD", region: "south_asia_pacific" },
  { countryCode: "SC", storefront: "sc", currency: "USD", region: "rest_of_world" },
  { countryCode: "SE", storefront: "se", currency: "SEK", region: "individual" },
  { countryCode: "SG", storefront: "sg", currency: "SGD", region: "individual" },
  { countryCode: "SI", storefront: "si", currency: "EUR", region: "euro_zone" },
  { countryCode: "SK", storefront: "sk", currency: "EUR", region: "euro_zone" },
  { countryCode: "SL", storefront: "sl", currency: "USD", region: "rest_of_world" },
  { countryCode: "SN", storefront: "sn", currency: "USD", region: "rest_of_world" },
  { countryCode: "SR", storefront: "sr", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "ST", storefront: "st", currency: "USD", region: "rest_of_world" },
  { countryCode: "SV", storefront: "sv", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "SZ", storefront: "sz", currency: "USD", region: "rest_of_world" },
  { countryCode: "TC", storefront: "tc", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "TD", storefront: "td", currency: "USD", region: "rest_of_world" },
  { countryCode: "TH", storefront: "th", currency: "THB", region: "individual" },
  { countryCode: "TJ", storefront: "tj", currency: "USD", region: "rest_of_world" },
  { countryCode: "TM", storefront: "tm", currency: "USD", region: "rest_of_world" },
  { countryCode: "TN", storefront: "tn", currency: "USD", region: "rest_of_world" },
  { countryCode: "TO", storefront: "to", currency: "USD", region: "south_asia_pacific" },
  { countryCode: "TR", storefront: "tr", currency: "TRY", region: "individual" },
  { countryCode: "TT", storefront: "tt", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "TW", storefront: "tw", currency: "TWD", region: "individual" },
  { countryCode: "TZ", storefront: "tz", currency: "TZS", region: "individual" },
  { countryCode: "UA", storefront: "ua", currency: "USD", region: "rest_of_world" },
  { countryCode: "UG", storefront: "ug", currency: "USD", region: "rest_of_world" },
  { countryCode: "US", storefront: "us", currency: "USD", region: "individual" },
  { countryCode: "UY", storefront: "uy", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "UZ", storefront: "uz", currency: "USD", region: "rest_of_world" },
  { countryCode: "VC", storefront: "vc", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "VE", storefront: "ve", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "VG", storefront: "vg", currency: "USD", region: "latin_america_caribbean" },
  { countryCode: "VN", storefront: "vn", currency: "VND", region: "individual" },
  { countryCode: "VU", storefront: "vu", currency: "USD", region: "south_asia_pacific" },
  { countryCode: "YE", storefront: "ye", currency: "USD", region: "rest_of_world" },
  { countryCode: "ZA", storefront: "za", currency: "ZAR", region: "individual" },
  { countryCode: "ZM", storefront: "zm", currency: "USD", region: "rest_of_world" },
  { countryCode: "ZW", storefront: "zw", currency: "USD", region: "rest_of_world" },
];

const APPLE_STOREFRONT_INDEX = new Map(APPLE_STOREFRONT_CATALOG.map((item) => [item.countryCode, item]));

export function findAppleStorefront(countryCode: string): AppleStorefrontCatalogItem | undefined {
  return APPLE_STOREFRONT_INDEX.get(countryCode.toUpperCase());
}

/** 用于枚举 Google 与 OpenAI 官网各国页面的候选国家码：与 Apple 商店目录一致。 */
export const OFFICIAL_COUNTRY_CANDIDATES: readonly string[] = APPLE_STOREFRONT_CATALOG.map((item) => item.countryCode);

const REGION_NAME_OVERRIDES: Readonly<Record<string, string>> = {
  CN: "中国大陆",
  HK: "中国香港",
  MO: "中国澳门",
  TW: "中国台湾",
  EU: "欧元区",
};

let regionNames: Intl.DisplayNames | null | undefined;

/** 中文地区名。Intl 不可用或代码未知时回退到代码本身。 */
export function regionDisplayName(countryCode: string): string {
  const code = countryCode.toUpperCase();
  const override = REGION_NAME_OVERRIDES[code];
  if (override) return override;
  if (regionNames === undefined) {
    try {
      regionNames = new Intl.DisplayNames(["zh-CN"], { type: "region", fallback: "code" });
    } catch {
      regionNames = null;
    }
  }
  if (!/^[A-Z]{2}$/.test(code)) return code;
  try {
    const name = regionNames?.of(code);
    // ICU labels reserved codes such as ZZ as "未知地区"; keep the raw code instead.
    return name && name !== code && name !== "未知地区" ? name : code;
  } catch {
    return code;
  }
}

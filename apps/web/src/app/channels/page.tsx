import type { Metadata } from "next";
import SubscriptionsPage from "../subscriptions/page";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "卡网订阅比价 | PriceAI",
  description: "PriceAI 聚合 AI 订阅卡网渠道报价，比较标准商品、最低价、库存、质保与渠道更新时间。",
};

export default SubscriptionsPage;

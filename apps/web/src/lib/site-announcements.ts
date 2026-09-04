export type AnnouncementKind = "community" | "service" | "update";

export interface SiteAnnouncement {
  id: string;
  badge: string;
  title: string;
  description: string | null;
  actionLabel: string;
  destinationUrl: string;
  kind: AnnouncementKind;
}

export interface SiteAnnouncementConfig {
  announcements: SiteAnnouncement[];
  rotationEnabled: boolean;
  rotationIntervalMs: number;
}

export const DEFAULT_ANNOUNCEMENT_CONFIG: SiteAnnouncementConfig = {
  announcements: [
    {
      id: "9968526a-bc8a-4bd6-8723-5da43aad4b11",
      badge: "社区开放",
      title: "QQ 和微信交流群已开启",
      description: "交流比价信息与使用经验",
      actionLabel: "加入交流群",
      destinationUrl: "/support?contact=community",
      kind: "community",
    },
    {
      id: "604bf313-1a82-48f7-9bb8-b326aeb7e218",
      badge: "新服务",
      title: "中转站模型检测服务已上线",
      description: "自带密钥，快速验证模型列表与连通性",
      actionLabel: "立即检测",
      destinationUrl: "/api-transit/detector",
      kind: "service",
    },
  ],
  rotationEnabled: true,
  rotationIntervalMs: 4_000,
};

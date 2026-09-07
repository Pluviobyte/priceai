# 原始魔方截图图标备份

这里保留首版透明冰晶魔方截图的三个图标文件。新版仅为浏览器小尺寸辨识度设计，未改变导航栏动态魔方。

回退：将本目录的 `favicon.ico`、`icon.png`、`apple-icon.png` 复制回 `apps/web/src/app/`，并移除 `layout.tsx` 的自定义 `metadata.icons` 配置。

新版资源由 `node scripts/generate-favicon.mjs` 生成：16–64px 使用简化的蓝色魔方，128px 及以上加入四个模型标记。标签页另有明确的 16/32/48px PNG 声明，避免把大图中的细节缩入小图。

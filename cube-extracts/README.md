# 魔方提取件

这个目录包含两个根据风格参考独立复刻的 WebGL 魔方：

- `vivid-prism.html` — Vivid+Co 风格的 RGB 色散玻璃立方体组。
- `resend-cube.html` — Resend 风格的黑色旋转立方体。
- `index.html` — 两个效果的入口页。
- `styles.css` — 页面样式与入口页。
- `src/` — Three.js 场景、材质、灯光和动画源码。
- `assets/` — 可直接在浏览器运行的打包结果。
- `vivid-tokens.css` — Vivid+Co 的原生 CSS 设计令牌，已被第一个魔方页面使用。
- `vivid-theme-tailwind.css` — 同一套令牌的 Tailwind v4 `@theme` 版本。
- `resend-tokens.css` — Resend 的原生 CSS 设计令牌，已被第二个魔方页面使用。
- `resend-theme-tailwind.css` — 同一套令牌的 Tailwind v4 `@theme` 版本。

没有外部图片、字体或 CDN 依赖。执行 `npm install` 和 `npm run build` 可重新构建 WebGL 脚本；已构建的 HTML 页面可直接打开。

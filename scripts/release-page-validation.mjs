export function validateReleasePage(path, html) {
  if (!path.startsWith('/channels')) return;
  const heading = path.includes('view=merchants') ? '卡网商家，一览再比较' : '选对交付方式，再比较价格';
  // Compare visible heading text, allowing presentational tags and React comments.
  const title = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
    .replace(/<!--([\s\S]*?)-->/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, '');
  if (title !== heading || html.includes('暂时无法读取渠道报价')) {
    throw new Error(`${path}: catalog did not load`);
  }
}

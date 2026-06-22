财富觉醒 Landing Page — 图片素材放置说明
==========================================

把你的两张图片放到这个文件夹（public/landing/），然后改两行代码即可启用：

1) Hero 背景大图（暗调城市 / 金色夕阳）
   - 文件：public/landing/hero.jpg   （建议 1920×1080 以上，JPG/WebP）
   - 启用：编辑 components/landing/WealthAwakeningPage.tsx
            把  const HERO_BG = null;
            改成 const HERO_BG = '/landing/hero.jpg';
   - 文字与遮罩会自动叠加，保证可读性。

2) Leon 专业头像
   - 文件：public/landing/leon.jpg   （建议正方形，至少 400×400）
   - 启用：编辑 components/landing/WealthAwakeningPage.tsx
            把 ADVISOR.photo: null
            改成 ADVISOR.photo: '/landing/leon.jpg'
   - 留空则显示字母「L」徽标。

3) 客户 testimonial（你有原话、无头像）
   - 无需图片，保留字母头像即可。
   - 把真实姓名 + 身份 + 原话发给我，我替换 WealthAwakeningPage.tsx 里的 TESTIMONIALS 样本。

注：public/ 下的文件部署后通过根路径访问，例如 public/landing/hero.jpg → /landing/hero.jpg

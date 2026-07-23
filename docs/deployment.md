# 自动构建与新文章工作流

## GitHub Pages

`.github/workflows/deploy.yml` 会在 `source` 分支收到 Push 后：

1. 使用 Node.js 24 和 `npm ci` 安装锁定依赖；
2. 执行 `npm run clean` 与 `npm run build`；
3. 检查 `public/index.html` 是否存在；
4. 仅把 `public/` 上传为 GitHub Pages artifact；
5. 部署到 `github-pages` 环境。

首次使用时，需要在 GitHub 仓库的 **Settings → Pages → Build and deployment →
Source** 中选择 **GitHub Actions**。之后 Push 到 `source` 即可自动发布，也可以在
Actions 页面手动运行该工作流。

旧的 `.github/workflows/pages.yml` 已移除，避免一次 Push 触发两次 Pages 部署。

## 创建文章

继续使用 Hexo CLI：

```bash
npx hexo new post "文章名"
```

也可以使用新增的 npm 快捷命令：

```bash
npm run new:post -- "文章名"
```

生成后请至少填写 `description`、`tags`、`categories`；系列文章再填写 `series`
与 `order`。完成后可运行：

```bash
npm run check:posts
```

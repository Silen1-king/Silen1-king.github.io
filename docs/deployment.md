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

工作流里的 Action 都固定到提交 SHA（行尾注释写着版本号），由 Dependabot 每周提 PR 更新。

## 安全策略（CSP）

GitHub Pages 不能自定义响应头，所以 `scripts/signal-csp.js` 在构建时给每个页面写入
`<meta http-equiv="Content-Security-Policy">`：脚本只允许本站和 giscus，页面里的内联
脚本按 SHA-256 自动放行。新增第三方脚本、iframe 或接口时，要把它的域名加进该文件的
`SOURCES`，否则浏览器会拦截。访问统计用的是 `source/js/visitor-count.js`（Vercount 接口），
本地预览（localhost）不计数。

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

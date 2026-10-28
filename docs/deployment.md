# 自动构建与新文章工作流

## GitHub Pages

`.github/workflows/deploy.yml` 会在 `source` 分支收到 Push 后：

1. 使用 Node.js 24 和 `npm ci` 安装锁定依赖；
2. 执行 `npm run test:checks`，验证发布检查器；
3. 执行 `npm run build`，自动检查文章、清理旧产物、生成站点并验证产物；
4. 仅把 `public/` 上传为 GitHub Pages artifact；
5. 部署到 `github-pages` 环境。

首次使用时，需要在 GitHub 仓库的 **Settings → Pages → Build and deployment →
Source** 中选择 **GitHub Actions**。之后 Push 到 `source` 即可自动发布，也可以在
Actions 页面手动运行该工作流。

旧的 `.github/workflows/pages.yml` 已移除，避免一次 Push 触发两次 Pages 部署。
`hexo deploy`（`hexo-deployer-git` 推送到 `main`）也已移除，发布只走上面的工作流。

## 主题配置

主题设置由根目录 `_config.next.yml` 覆盖默认配置；`themes/next` 内的首页、归档、
导航等模板也有站点定制。升级 NexT 时需要比较并合并这些修改，不能直接替换主题目录。

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

## 草稿与生产构建

`_config.yml` 默认设置 `render_drafts: false`。正式发布只使用：

```bash
npm run build
```

该命令通过 npm 的 `prebuild` / `postbuild` 自动执行文章检查、`hexo clean` 和
产物检查。清理能避免之前预览生成的草稿页面残留。任一步失败都会阻止 CI 上传和部署。
不要用裸 `hexo generate` 替代生产构建命令，否则会绕过这些检查。

本地查看草稿使用：

```bash
npm run server:drafts
```

普通预览仍使用 `npm run server`。发布草稿后，补齐元数据和图片目录，再运行完整构建。
草稿图片暂留在 `_drafts`，不要提前移到公开的 `source/images`，后者会随站点发布。

## 正式文章图片

统一存放于 `source/images/posts/<文章文件名去掉 .md>/`，Markdown 使用站点绝对路径：

```markdown
![图片说明](/images/posts/my-post/example.png)
```

例如 `source/_posts/my-post.md` 对应 `source/images/posts/my-post/`。
文件名含空格时使用 `![说明](</images/posts/my-post/截图 1.png>)`。
外部图片 URL 可以保留；本地图片不再散放在 `_posts`，也不再自动创建 Hexo 文章资源文件夹。
迁移同名图片时先改名，避免覆盖已有文件。

## 产物检查

`npm run check:site` 可独立检查最近构建的 `public/` 和 `db.json`，不重新生成页面。
检查内容包括：

- 首页、404、正式文章、搜索索引、站点地图和订阅文件存在；
- HTML 的本地页面、图片、脚本、样式链接，以及 CSS 字体和图片引用有效；
- 搜索记录、站点地图和 Atom 链接指向存在的本地文件；
- 本地路径大小写完全一致，即使在 Windows 上检查也能发现 Linux 部署问题；
- 生产配置未开启草稿，草稿页面没有混入产物或被上述索引引用。

检查器忽略外部 URL 和页内锚点，不验证远程服务可达性或 JavaScript 运行时拼接的 URL。
`npm run test:checks` 使用临时目录测试损坏资源、草稿泄漏、搜索 JSON 和子目录路径。

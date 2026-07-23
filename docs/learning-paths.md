# 学习路线与文章元数据工具

## 路线页面

`learning-paths.js` 会在每次执行 `hexo generate` 时生成 `/learning-paths/`。
文章优先按 `series` 分组；没有 `series` 时，默认按 `categories` 分组。

```yaml
---
title: 栈溢出入门
date: 2026-07-24
description: 从调用栈开始理解最基础的栈溢出。
categories: 学习笔记
tags:
  - PWN
series: PWN 入门
order: 1
---
```

同一专栏内，填写了 `order` 的文章按数字升序排在前面；未填写的文章按发布日期升序排列。
页面地址、标题、说明和分类回退行为可在站点 `_config.yml` 的 `learning_paths` 中调整。

## 元数据检查

在博客根目录运行：

```bash
npm run check:posts
```

脚本递归检查 `source/_posts` 下所有 Markdown 文件的 `description`、`tags` 和 `date`。
发现缺失或 Front-matter 格式错误时会输出警告并使用退出码 `1`；全部完整时退出码为 `0`。

检查其他目录：

```bash
node scripts/check-posts.js --dir source/_drafts
```

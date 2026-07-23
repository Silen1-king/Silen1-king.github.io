# 文章渲染增强

## 代码块

标准 Markdown 围栏代码块无需修改：

````markdown
```javascript
console.log('Hello');
```
````

构建后会自动显示语言标签与复制按钮。兼容 Hexo Highlight.js 的
`figure.highlight`、Prism 的 `language-*`，以及普通 `<pre><code>` 结构。

## Alert 提示框

支持 GitHub/Obsidian 风格的五种提示：`NOTE`、`TIP`、`IMPORTANT`、
`WARNING`、`CAUTION`。

```markdown
> [!NOTE]
> 这是一条补充说明。

> [!WARNING]
> 执行命令前请先备份重要数据。
```

## 文章时效提示

脚本优先读取 Front-matter 中显式填写的 `updated`，未填写时使用 `date`：

```yaml
date: 2024-01-10
updated: 2025-06-18
```

最后更新时间超过一年时，正文顶部会自动显示时效提示。脚本不会使用文件
mtime 代替 `updated`，因此复制或重新构建文章不会意外改变判断结果。

## 关联推荐

每篇文章末尾自动展示最多 3 篇相关内容。共同标签每项计 3 分，共同分类每项
计 2 分；按得分、发布日期依次排序。没有标签或分类交集的文章不会被推荐。

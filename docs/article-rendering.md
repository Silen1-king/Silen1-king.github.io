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

### 终端风格

`bash`、`sh`、`shell`、`zsh`、`console` 代码块显示为终端：每条命令前有 `$`
提示符，没有行号。紧跟在命令后面的 `text` 代码块被当作它的输出，合并进同一个框，
颜色稍暗；复制按钮只复制命令。

````markdown
```bash
checksec --file=chall1
```

```text
RELRO           STACK CANARY      NX            PIE
Partial RELRO   No canary found   NX disabled   No PIE
```
````

- 两个代码块之间不能有文字，有文字就各自显示。
- 以 `\` 结尾的续行、heredoc（`<< 'EOF'` 到 `EOF`）、空行和注释不加提示符。
- 以 `#!` 开头的脚本、或已经自己写了 `$ ` 的代码块保持原样，带行号显示。
- 单独的 `text` 代码块不显示行号。
- 只改显示效果，Markdown 原文不变。

### 同址高亮

用鼠标指着代码里的一个地址或名字，文章里所有代码块和行内代码中相同的值会一起
高亮，就像在 IDA 里点中一个符号。地址按数值比较，所以 nm 打印的
`0000000000401186`、objdump 里的 `401186` 和 exploit 里的 `0x401186` 算同一个。

- 地址：`0x` 开头的十六进制，或 6 到 16 位、至少含一个数字的十六进制（nm、objdump 的写法）。
- 名字：两个字符以上的标识符，如 `fun`、`FUN_ADDR`、`rdi`，大小写敏感。
- 写文章时不用做任何标记。只在用鼠标时生效，由 `source/js/post-enhancements.js`
  通过 CSS Custom Highlight API 绘制，不改动代码的 HTML，复制不受影响。

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

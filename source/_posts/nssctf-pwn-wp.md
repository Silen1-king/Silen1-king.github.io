---
title: nssctf比赛的wp（只有pwn题目的）（线上赛，有使用AI）
date: 2026-10-24
description: NSSCTF 新生赛的 pwn 题 wp：nc 签到题里的格式化字符串漏洞（%p 和 %s 的用法），以及 creeper 题里用 usleep 窗口打出的竞态条件，附几个新学的 IDA 快捷键。
categories: CTF
tags:
  - pwn
  - format-string
  - race-condition
  - ida
---

看到这个什么新生赛过来参加一下，用用最新的方法论，找找感觉

## 第一题：nc签到？黑盒

> 只需nc的签到题，简简单单...%p%p%p%s....

这道题就是TMD老叟戏顽童！！多的不说，请看VCR：

![alt text](/images/posts/nssctf-pwn-wp/image-1.png)

懂我意思？真心换真心，耍我耍了半天。没招，AI大人出来吧

哦，这是一个格式化字符串漏洞。

题目提示：只需nc的签到题，简简单单...`%p%p%p%s`....

其实关键是在理解`%p`和`%s`是干什么的

它们是 printf 的占位符，各有分工：

- `%p` —— 把栈上的值当作指针（地址），以十六进制打印出来。你连发一堆 `%p`，相当于把栈从低到高一格一格 dump 出来。
- `%s` —— 把栈上的值当作一个指针，然后解引用，去那个地址把字符串读出来。

正常的printf书写：`printf("%s", input);`有这个漏洞的源码大概率是`printf(input);`

这二者的区别在于，第一个：`%s`是命令-我要打印字符串，input-从哪儿来的字符串;第二个：直接把input当作命令，而当我们输入`%p`时，`%p`就是命令

所以思路就简单了：利用`%p`看看栈里面有什么，会有一堆十六进制数。这道题目flag就直接在栈里面，被直接输出了，再通过`p64（）`转为ASCII 字符

但是ai大人提醒，还有一个稍微复杂一点的情况，就是实际上flag不直接在栈里面，只是flag的地址在栈里面，我们就需要利用好`%s`去flag的地址，`%1$s` `%2$s`......直到出现flag

回看这道题，感觉试图用“真心”拿到flag的我好愚蠢

## 第二道：creeper?

> 史蒂夫弄丢了他的钻石镐，你能帮他重新做一把吗？

这道题目是我目前见过最难的，`Canary found   NX enabled   PIE enabled`，不过我今天也学了一个强大的逆向工具IDA（在文章的末尾放上了一些新学的IDA知识）

在IDA里先看看main函数

![alt text](/images/posts/nssctf-pwn-wp/image-2.png)

锁定sub_12A9和sub_152A

发现sub_12A9是一个初始化函数

![alt text](/images/posts/nssctf-pwn-wp/image-3.png)

所以重点还是在 sub_152A这个主要函数上

先读懂main函数里都发生了什么

```text
v1 = sub_1317()，v1是sub_1317函数的返回值
在v1=1时，并且dword_4018 != 0
sub_144B(a1: sub_137B)    ---一个函数调用了另一个函数
在v1=2时，并且dword_401C != 0
sub_144B(a1: sub_13E3);
如果前面触发了break便会进入LABEL_4
```

![alt text](/images/posts/nssctf-pwn-wp/image-5.png)

我能发现到`diamond <= 2`或`dword_4014 <= 1`的情况下，会输出Not enough!

而只有在`diamond >=3`和`dword_4014 >= 2`时，才会输出Craft success

从而调用 sub_14CB,里面有 `system("$0")`，拿到 shell

我们发现题目是存在一个赢的方法，那为什么要做呢？一定是在游戏的某个策略导致无法同时满足`diamond >=3`和`dword_4014 >= 2`，那这个题目的思路就清晰了，去前面调用过的函数里面找到这个漏洞，解决它

### sub_1317

首先看sub_1317

![alt text](/images/posts/nssctf-pwn-wp/image-11.png)

其实就是读一行输入 → 转成整数 → 返回给菜单做选择

缓冲区 `s[40]`，输入`fgets(s, n: 32, stream: stdin) == nullptr`，无栈溢出

### sub_144B

看sub_144B（调用sub_137B的函数）

![alt text](/images/posts/nssctf-pwn-wp/image-12.png)

如果`dword_404C > 127`，程序崩溃，

`<127`,开一个线程执行a1--传进来的函数sub_137B

### sub_137B

看sub_137B

![alt text](/images/posts/nssctf-pwn-wp/image-6.png)

我们发现了什么！

在`dword_4018 == 1`的时候，我们多了一个钻石，但是dword_4018又被赋了0，也就是说这个函数只能执行一遍，我们就获得了一个钻石

但事情还有转机，`usleep(useconds: 0x186A0u)`，可能是为了确保我们的输入能被机器读取到这里有一个0.1秒的停顿，也就是，sub_137B函数在这0.1秒内无法把dword_4018赋为0，而我们的主程序是没有停顿的，因为sub_144B开了一个线程调用sub_137B，如果此时我们再输入9个1，那么在这个0.1秒之后，有几个钻石要增加？10个！

> 注：`usleep(useconds: 0x186A0u)`指的是停留0.1秒，0x186A0 = 十进制 100000，usleep 的单位是微秒

### sub_13E3

同理看sub_13E3

![alt text](/images/posts/nssctf-pwn-wp/image-8.png)

同样的方法，我们的木棍也有了。

现在我们已经找到成功的办法了，写一个文件，使得在0.1秒内输入大量1

![alt text](/images/posts/nssctf-pwn-wp/image-9.png)

**总结：这个漏洞叫竞态条件(Race Condition),具体是TOCTOU(检查时刻≠使用时刻)**

## IDA知识：

- 按 N 给变量改名
- 按 X 键(交叉引用)，它会列出所有用到这个变量的地方

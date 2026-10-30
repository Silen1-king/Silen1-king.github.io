---
title: nssctf比赛的wp（只有pwn，线上赛，有使用AI）
date: 2026-10-26 01:43:57
updated: 2026-10-30 16:40:18
description: NSSCTF 新生赛的 pwn 题 wp：nc 签到题里的格式化字符串漏洞，creeper 题里用 usleep 窗口打出的竞态条件，never_arrive 题里 64 位转 32 位的截断，going_run 题里每轮只挪一格的 read 改写循环变量、跳到后门函数，附几个新学的 IDA 快捷键。
categories: CTF
tags:
  - pwn
  - format-string
  - race-condition
  - ida
  - integer-truncation
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

## 第三题：never_arrive

> 又大又小，该怎么办啊喵？

`canary found      NX enabled    PIE enabled`

在IDA里看main函数

![alt text](/images/posts/nssctf-pwn-wp/never-arrive-1.png)

先是一些初始化操作，然后是一个if语句

关键就是这一步，只要满足`(int)vuln() <= 255`，就会执行`system(command: "/bin/sh")`，拿到shell

我们一起去看一下vuln函数做了什么

![alt text](/images/posts/nssctf-pwn-wp/never-arrive-2.png)

- `_QWORD v1[2]`：一个名为 v1 的数组，里面有 2 个元素，每个元素占 8 字节（64 位）
- `v1[1] = __readfsqword(0x28u)`：存储stack canary
- `__isoc99_scanf(a1: "%lld", v1)`：读取用户输入

这个条件判断也很奇诡，如果`v1[0] <= 255LL`，程序崩溃，如果`v1[0] > 255LL`，返回`v1[0]`的值，但在主函数里就不满足`(int)vuln() <= 255`

Why？这不就形成一个悖论了吗？仔细寻找是否有什么地方存在漏洞。

思考一下，为什么同样的一个数，在main函数的判断里是`<= 255`的，而在vuln函数的判断里是`> 255LL`

没招，我问了一下Claude，让他给我一个停止我这个思考的最小提示：

> 注意两个比较的「类型/位宽」不一样。vuln 里是 `v1[0] > 255LL`（LL = 64 位 long long），而 main 里是 `(int)vuln() <= 255`（`(int)` = 32 位）。同一个数，用 64 位看和用 32 位看，可以是两个完全不同的值。

豁然开朗，我们只要输入一个数，在64位的时候`> 255LL`，而在低32位时`<= 255`

比如：`0x0000000100000000`，在低32位时是`0x00000000`。

还有一个小细节：在scanf里读取的是`%lld`。十进制数，直接输入`0x0000000100000000`是不行的

写exploit：

![alt text](/images/posts/nssctf-pwn-wp/never-arrive-3.png)

![alt text](/images/posts/nssctf-pwn-wp/never-arrive-4.png)

结束，完胜到手！

## 第四题：going_run

> 你跑不过我，你信不信

张雪峰老师，我还记得你！

`No canary found   NX enabled    No PIE`   还有啥好说的，栈溢出

![alt text](/images/posts/nssctf-pwn-wp/going-run-image.png)

init（）我查了一下，是初始化的函数

i和j初始都是0

在这个for循环里，j从0开始，每一个循环+1，直到j>32，也就是这个循环经历33次

`read(fd: 0, buf: &s[i++], nbytes: 8u)`  ---解释一下 read：Linux里读取数据的；&：取该元素的内存地址，该元素是s[i]，然后i自增；最多读取 8 字节

然后做判定，i > 40 ，exit(0)。i <= 40.重新进入循环

思考，当j等于33时，i等于多少？i=33，真的是这样吗？错！

注意： `char s[16]; // [rsp+0h] [rbp-20h] BYREF`

溢出了！

这就呼应了一开始`checksec --file=going_run`得到的No canary found

然后我在左侧函数里发现另外一个gitf函数

![alt text](/images/posts/nssctf-pwn-wp/going-run-image-1.png)

打开一看

![alt text](/images/posts/nssctf-pwn-wp/going-run-image-2.png)

哟，你在这啊

现在问题就简单了，找到缓冲区大小，设计一下栈溢出，然后让cpu返回到gitf函数的地址，执行`system(command: "/bin/sh")`，拿到shell

注意No PIE，主程序代码地址固定所以直接在wsl里执行 `nm going_run | grep ' T \| t '`，找到gitf的地址

![alt text](/images/posts/nssctf-pwn-wp/going-run-image-4.png)

gitf的地址是`0x0040121d`

`objdump -d -M intel going_run`，主要看main和gitf

![alt text](/images/posts/nssctf-pwn-wp/going-run-image-5.png)

缓冲区大小32+rbp8

看gitf

![alt text](/images/posts/nssctf-pwn-wp/going-run-image-3.png)

那我们就是40个'A'灌进去加一个返回地址咯

写exploit

![alt text](/images/posts/nssctf-pwn-wp/going-run-image-6.png)

执行

![alt text](/images/posts/nssctf-pwn-wp/going-run-image-7.png)

没反应，失败，查找原因，重新理解一下这个题目

请教一下Claude

这并不是一个简单的普通的线性溢出，在简单的ret2win题目上有了一点小改变

关键在于对`read(0, &s[i++], 8)`的理解

每次读取8字节，但i每轮只增加1

```text
第0轮 i=0:  刷  0 1 2 3 4 5 6 7
第1轮 i=1:  刷    1 2 3 4 5 6 7 8     ← 和上一笔重叠7格
第2轮 i=2:  刷      2 3 4 5 6 7 8 9
```

就像是一把 8 格宽的刷子，每次只走 1 步，所以每一笔都在反复涂刚才涂过的地方

所以我前面放在队尾的gitf地址根本到不了第40 格

那会想：我为什么不多来几个A啊？

这就涉及到变量在栈中的地址，我们放入的A覆盖了变量的值，导致了循环的破坏

其实，在之前的笔记中我已经探讨过栈的一些结构，但这一次，我们需要在反汇编中重新理解它

![alt text](/images/posts/nssctf-pwn-wp/going-run-image-8.png)

把旧 rbp 压栈，开辟 0x20=32 字节局部空间（第一次知道有这么一个说法：由于 x86-64 的栈向低地址增长，rsp 减少 32，意味着为局部数据预留了 32 字节空间，有点细节）

所以已知的：返回地址在 rbp+8，旧 rbp 在 rbp+0，有一个32字节的空间

接下来是第一次学习到的，

```text
401276: mov  DWORD PTR [rbp-0x4],0  ; 有个4字节变量在 rbp-0x4, 初值0
40128c: mov  DWORD PTR [rbp-0x8],0  ; 又有个4字节变量在 rbp-0x8, 初值0
```

DWORD（Double Word）在 x86 体系中代表 32 位（4 字节）

我一开始十分疑惑，欸，怎么从这么多汇编指令中找到这个，判断这两行描述的就是变量啊，

其实单从前面的赋值语句是看不出来的，要通过多个特征判断（要快速分辨的话确实需要经验），基于这道题目特征是：初始化为 0，反复读取，每次增加 1，与 40 比较。

我在学习的时候进入了一个小误会：就是栈是向低地址增长的，i的值是一直在发生变化的，我以为变量的地址也会跟着变，其实不是的，变量的地址基于当前栈帧的 rbp 固定，也就是说当我们看到一个地址被反复调用并不断地发生变化的时候，就可以怀疑，这个地址存的是不是一个变量了------这波也可能是我蠢了

我说实话，我这个汇编指令读得真有一点吃力，该去pwn.college进修一下了

```text
小tips：rbp-0x4：计算一个内存地址   [rbp-0x4]：读取这个地址中存储的值。
        cdqe：将 eax 中的 32 位有符号整数扩展成 64 位，结果存入 rax
        lea：计算一个内存地址，把计算结果放进寄存器，但不读取该地址中的数据
        在 Linux x86-64 的函数调用约定中，rdi  → 第1个参数，rsi  → 第2个参数， rdx  → 第3个参数
        jmp ：无条件跳转
        jle：Jump if Less or Equal，有符号比较中小于或等于时跳转
```

根据前面的推理，我们知道两个存储变量的地址，在IDA的分析中，我们知道了确实有两个变量，怎么对应上呢？我们继续分析，

```text
401295: lea rdx,[rbp-0x20]
401299: mov eax,DWORD PTR [rbp-0x4]
40129c: cdqe
40129e: add rax,rdx
4012a1: mov edx,0x8
4012a6: mov rsi,rax
4012a9: mov edi,0x0
4012ae: mov eax,0x0
4012b3: call read@plt    // read（edi ，rsi，edx）     read（文件描述符 ，存放数据的地址，最多读取多少字节）0指的是标准输入
4012b8: add DWORD PTR [rbp-0x4],1
```

rbp-0x20这个地址对应的变量用于计算数组元素的地址，并被传给了 read，然后再加一，干的是i的活

同理

```text
401293: jmp 4012e4 <main+0x84>

4012e4: cmp DWORD PTR [rbp-0x8],0x20
4012e8: jle 401295 <main+0x35>
```

so，rbp-0x8地址的变量控制循环次数

来自Claude的小提醒：IDA 给你标的 char s[16] 那个 16 是它瞎猜的，别信。真正可靠的锚点是 lea rdx,[rbp-0x20] 这句——缓冲区从 rbp-0x20 开始。

分析完这些局部变量，我们要步入正轨，去算离 buf 多少格

目前的栈情况如下

```text
                   高地址
                     ↑
              +------------------+
rbp+0x08      | 返回地址 (8字节)  |
              +------------------+
rbp           | 旧 rbp (8字节)   |
              +------------------+
rbp-0x04      | i (4字节)        |
              +------------------+
rbp-0x08      | j (4字节)        |
              +------------------+
              |                  |
              | 其他空间 (8字节) |
              |                  |
rbp-0x10      +------------------+
              |                  |
              | buf (16字节)     |
              |                  |
rbp-0x20      +------------------+
                     ↓
                   低地址
```

注意已知：全程唯一能往内存写东西的就是 read，从第 i 格开始，往后写 8 格，每转一圈：i 加 1；如果 i>40 就 exit；然后 j 加 1；只要 j≤32 就再转一圈。

注意目的：让程序 ret 的时候跳到 gitf。ret 会跳到返回地址里存的值，而返回地址在第 40 格

面对的问题：需要让read一次写第 i 到 i+7 格，要让这 8 格盖住第 40 格，i 必须落在 33 到 40 之间，如何让某一笔的 i 落在 33\~40？

一开始我失败过一次，i 自然根本走不到 33\~40，它从 0 开始，每圈 +1。循环靠 j≤32 控制，j 也从 0 开始每圈 +1。所以转到停，i 最多也就到 32 左右

思考：既然i最多到32格，那么这32格都有啥呢，有i的地址！i在第28格！

我们可不可以覆盖第 28 格，把 i 这个数字本身修改了

等i自然爬到一个合适的位置，用一笔 read 把 i 这个数字改大，逼它下一笔直接跳到第 40 格去写地址

这个合适的位置是哪呢？

j 占24\~27，i 占28\~31。i = 24，这一笔写第 24\~31 格，不多不少，j 和 i 全盖住

然后下一步就思考i要调到哪里啊？40！就在返回地址那！

错！

注意：每笔刷完会 i++，而且 i++ 后如果 >40 就 exit

这个时候，i选择39

前面为什么要把j考虑进去？因为j<=32循环是要继续的，i跳到39后，循环要立马停止，也就是说我们改完的j值要满足加1小于等于32，加2大于32，所以j=31

于是有了如下结论：

| 在哪动手 | i 设成 | j 设成 |
| --- | --- | --- |
| i 爬到 24 那笔 | 38 | 31 |

结合gitf 的地址：`0x40121d`

写exploit：

![alt text](/images/posts/nssctf-pwn-wp/going-run-image-9.png)

- 反思0：第四题有点小超标，这种构造题需要更高的熟练度，只能说继续成长吧
- 反思1：这个汇编指令老是忘啊，准备整理一期常用的放出来，真的坑！我是真的菜！
  这跟我准备盖大厦了，结果水泥没了有何区别！！！
- 反思2：先 push rbp;mov rbp,rsp 认锚点 → 读 sub rsp 和 [rbp-X] 认局部变量 → 全换算成离 buf 的偏移 → 返回地址固定在 buf+(0x20+8)。

## IDA知识：

- 按 N 给变量改名
- 按 X 键(交叉引用)，它会列出所有用到这个变量的地方
- 按F5，把IDA View-A（汇编视图）反编译为Pseudocode（伪代码视图）。

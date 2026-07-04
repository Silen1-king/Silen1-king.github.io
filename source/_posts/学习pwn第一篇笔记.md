---
title: 学习pwn第一篇笔记
date: 2026-05-10 01:01:58
categories: 学习笔记
tags: PWN
---
## 第一次接触pwn

首先学习的是Linux命令行，输入一串指令时，第一个词是命令，后面的词是参数

### 比如：
    ```bash
    echo Hello Hackers!
    ```
    终端显示：Hello Hackers!

· echo 是命令
· Hello 和 Hackers! 是两个参数
· echo 的作用就是把参数"回显"到终端

## 个人理解

pwn赛题要求我们正确调用命令，并寻找正确的参数，寻找参数会出错，直到正确参数出现，返回flag
赛题中会提示我们命令和参数，读题很关键
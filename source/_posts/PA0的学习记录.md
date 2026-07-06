---
title: PA0的学习记录
date: 2026-05-30 13:51:00
categories: 学习笔记
tags: PAs
---
一个学习网站

<!-- more -->
## 习惯阅读英文材料

## 学习了几个命令
df -h  :查看磁盘空间占用情况
poweroff   :关闭操作系统的，需要root权限，一个良好的关闭习惯，尤其是在虚拟机中。
su -    :切换至root用户      (su - username)  

## 忘记了root用户的密码，如何重置密码
1. 管理员运行CMD
2. 输入 wsl -u root  提示符从$变成#,  # is the indicator of root account
3. 输入 passwd root 然后重置密码

## 新名词
package manager  ：download and install softwares in GNU/Linux . In Ubuntu, the package manager is called apt.

## Checking network state
ping mirrors.tuna.tsinghua.edu.cn -c 4 

命令各部分释义：
ping: 网络测试工具，用于检测目标服务器是否可达、测量网络延迟
mirrors.tuna.tsinghua.edu.cn: 要探测的目标地址，即清华镜像源的域名
-c 4: 指定发送探测包的数量，这里是发送4个包后自动停止测试

## 查看Ubuntu版本
cat /etc/os-release

## learn by usage
vim编辑器

## 


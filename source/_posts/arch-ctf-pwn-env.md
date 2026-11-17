---
title: Arch Linux CTF Pwn 环境配置清单
date: 2026-11-15 03:16:43
description: 在 VMware 里的 Arch Linux（KDE Plasma / Wayland）上搭好的 CTF Pwn 环境：gcc、gdb + pwndbg、pwntools、Ghidra、QEMU、Docker 等工具与 32 位运行库，pwndbg 需在 ~/.gdbinit 中 source 才会加载，debuginfod 调 libc 源码，Docker 提取题目 libc 的脚本，tmux / Vim 配置，日常取题做题流程，以及已知限制。
categories: CTF
tags:
  - pwn
  - arch-linux
  - 环境配置
series: 其他
---

看了几个大高手的解题视频，都有在使用这个虚拟机，心血来潮配置一个，具体比起原来Ubuntu，是否有明显的优势或者提高，还需要时间和经历感受

> 本清单已省略用户名、IP、密码、密钥指纹、邮箱及宿主机路径，可用于分享。

## 基础环境

| 项目 | 配置 |
|---|---|
| 虚拟化平台 | VMware Workstation Pro |
| 操作系统 | Arch Linux，x86_64 |
| 桌面环境 | KDE Plasma，Wayland |
| 虚拟机资源 | 4 核 CPU、8 GB 内存、80 GB 磁盘 |
| 远程连接 | SSH，支持密钥认证 |
| 软件源 | core、extra、multilib |
| 语言支持 | 中文字体、Fcitx5 拼音输入法 |
| Locale | 已生成 `en_US.UTF-8`、`zh_CN.UTF-8` |
| VMware 集成 | open-vm-tools、gtkmm3 |

软件安装统一使用：

```bash
sudo pacman -Syu --needed <软件包>
```

## 开发、调试与逆向工具

已安装：

```text
gcc            gdb             pwndbg
python         python-pwntools checksec
patchelf       ropgadget       ropper
one_gadget     pwninit         strace
ltrace         nasm            socat
tmux           qemu-user       ghidra
nodejs         npm             vim
docker         docker-compose
```

已安装 32 位运行库：

```text
lib32-glibc
lib32-gcc-libs
```

验证结果：

- 32 位、64 位 C 程序均可编译和运行。
- pwntools `process()` 可启动两种架构的程序。
- GDB 可在 `main` 处断下；**pwndbg 需在 `~/.gdbinit` 中 source 后才会加载**（见下文「调试器加载」）。
- 测试程序确认关闭栈保护和 PIE。
- QEMU 用户态运行测试通过。
- Ghidra 导入、分析通过（图形界面与无界面均可）。

## 调试器加载（重要，修正项）

pwndbg 不会自动生效，必须在 `~/.gdbinit` 里显式 source。若缺失，进入 gdb 后提示符是 `(gdb)`，且 `stack`、`telescope`、`vis` 等 pwndbg 命令会报 `Undefined command`。

`~/.gdbinit` 正确内容（pwndbg 的 source 行放在最前）：

```gdb
source /usr/share/pwndbg/gdbinit.py

# Arch 官方调试符号与源码
set debuginfod enabled on
set debuginfod urls https://debuginfod.archlinux.org
```

补全方法：

```bash
# 1. 确认 pwndbg 的 gdbinit.py 路径
ls /usr/share/pwndbg/gdbinit.py
# 若报 No such file，用下面命令查实际路径：
pacman -Ql pwndbg | grep gdbinit.py

# 2. 把 source 行加到 ~/.gdbinit 最前面
sed -i '1i source /usr/share/pwndbg/gdbinit.py' ~/.gdbinit
```

验证：进入 `gdb ./任意程序`，提示符应变为 `pwndbg>`；`break main` + `run` 后出现彩色的 REGISTERS / DISASM / STACK 面板，`stack 20`、`telescope $rsp 20` 可用。

## Docker

- Docker 服务已启用并设置开机启动。
- 日常用户已加入 docker 组。
- 无需 sudo 运行 Ubuntu 容器验证通过。
- Docker Compose 可用。

## 工作目录

```text
~/ctf/
├── challenges/
├── tools/
│   ├── getlibc.sh
│   ├── glibc-src/
│   │   ├── glibc-2.35/
│   │   └── README.md
│   └── workflow-check/
├── template/
│   └── exp.py
└── coreutils.md
```

`exp.py` 支持：

- 本地运行。
- GDB 调试，终端采用 tmux 左右分屏。
- REMOTE 远程连接。

三种模式均已验证。

## tmux

配置文件：`~/.tmux.conf`

- 开启鼠标和 focus-events。
- 回滚行数：100000。
- `Alt+方向键`：切换相邻窗格，无需前缀。
- `Alt+0～9`：选择对应窗口，无需前缀。
- `Alt+a～z`：直接选择 0～25 号窗格。

已有配置修改前保留备份。

## Vim

配置文件：`~/.vimrc`

- 开启行号、语法高亮和文件类型识别。
- 开启 autoread。
- FocusGained、BufEnter 事件触发 checktime。
- 未修改的缓冲区可自动重载外部变更。
- 安装 coc.nvim、coc-pyright。
- Python 补全、类型诊断和语法诊断验证通过。

常用按键：

| 按键 | 功能 |
|---|---|
| `Ctrl+Space` | 触发补全 |
| `Enter` | 确认已选补全项 |
| `[g` / `]g` | 上一处／下一处诊断 |
| `gd` | 跳转定义 |
| `gr` | 查看引用 |
| `K` | 查看悬浮信息 |
| `行号G` 或 `:行号` | 跳转到指定行（配合 Python 报错行号定位） |

## libc 源码调试

配置文件：`~/.gdbinit`（debuginfod 部分，完整内容见「调试器加载」）

```gdb
set debuginfod enabled on
set debuginfod urls https://debuginfod.archlinux.org
```

- 已验证自动获取系统 libc 的调试符号和源码。
- GDB 可在 `__libc_malloc` 处显示 `malloc.c`。
- 已下载并解压 glibc 2.35 上游示例源码。
- README 包含按 Build ID 匹配调试符号及 `set substitute-path` 的说明。

注意：示例源码不能直接替代其他版本或发行版补丁对应的源码。

## libc 提取脚本

脚本：`~/ctf/tools/getlibc.sh`

```bash
~/ctf/tools/getlibc.sh ubuntu:22.04 新输出目录
```

行为：

- 使用 `docker create` 创建临时容器。
- 使用 `docker cp -L` 提取 libc 和动态加载器。
- 退出时删除临时容器。
- 拒绝覆盖已有输出目录。
- Ubuntu 22.04 实测通过，产物经 `file` 确认为 ELF64。

## 显示与 VMware 剪贴板

- Konsole 已建立 CTF 配置，字体为 Hack、9 磅。
- 高分辨率下曾验证达到 94 行、270 列。
- 日常显示已恢复为适合 VMware 窗口的分辨率，100% 缩放。
- 需要满足「终端 ≥80 行、140 列」时：VMware 全屏（Ctrl+Alt+Enter）回到高分辨率，必要时在 Konsole 调大字号，用 `stty size` 验证。

以下服务均已启用并运行：

```text
vmtoolsd.service
vmware-vmblock-fuse.service
```

自动启动文件存在：

```text
/etc/xdg/autostart/vmware-user.desktop
```

剪贴板插件依赖已补齐，插件加载成功。

## 日常取题与做题流程

1. 在虚拟机 Firefox/Chromium 里登录比赛平台下载附件（Windows→虚拟机方向的粘贴可用，便于填网址账号）。
2. 一题一目录：`~/ctf/challenges/<比赛_题目>/`，题目文件、`exp.py`、`note.md` 放一起。
3. 侦察：`file ./chall`、`chmod +x ./chall`、`pwn checksec ./chall`。
4. 逆向：Ghidra（本机）或 IDA（Windows）看 `main`，定位漏洞点与后门函数。
5. 调试：tmux 内 `python exp.py GDB`，gdb 自动在右侧窗格弹出。
6. 远程：改 `exp.py` 顶部 HOST/PORT，`python exp.py REMOTE`。

## 已知限制与未验证项

| 项目 | 当前状态 |
|---|---|
| Windows → 虚拟机复制 | 已确认可用 |
| 虚拟机 → Windows 复制 | 仍不可用，现象符合 Wayland 兼容问题（上游限制，不修） |
| one_gadget 分析系统 glibc 2.44 | 未找到结果（新版 glibc 正常现象）；分析 Ubuntu libc 成功 |
| Ghidra 图形界面 | 已可打开并分析 |
| 中文输入交互 | 已确认可输入中文 |
| 当前日常分辨率下终端 ≥80 行 | 需全屏切高分辨率，见「显示」一节 |

未更换桌面环境或显示管理器，未安装额外剪贴板同步工具。

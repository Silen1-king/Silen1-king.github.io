---
title: "概率论与数理统计笔记（持续更新ing）"
date: 2026-11-22 22:15:36
updated: 2026-11-22 22:29:02
description: 概率论与数理统计笔记第一部分：加法、减法、条件概率与独立性四大公式，古典概型，全概率公式与贝叶斯公式的两阶段解题步骤，以及伯努利概型。
categories: [学校课程]
tags: [概率论]
math: true
published: false
---

## 一、随机事件及其概率

### 1. 利用“四大公式”求事件概率

#### ① 加法公式

1° $A \cup B$：$A, B$ 至少发生一个。

2°

$$
P(A \cup B) = P(A) + P(B) - P(AB)
$$

3°

$$
\begin{aligned}
P(A \cup B \cup C) &= P(A) + P(B) + P(C) \\
&\quad - P(AB) - P(AC) - P(BC) + P(ABC)
\end{aligned}
$$

口诀：奇加偶减。

不相容：$AB = \varnothing$

#### ② 减法公式

$$
P(A-B) = P(A) - P(B)
$$

对立事件：

$$
P(\overline{A}) = 1 - P(A)
$$

#### ③ 条件概率公式

$$
P(A \mid B) = \frac{P(AB)}{P(B)}
$$

$$
P(A\overline{B}) = P(A) - P(AB)
$$

![维恩图，A 与 B 的交集有斜线阴影](/images/posts/probability-notes/venn-diagram.svg)


① $A$ 与 $B$ 独立 $\Longleftrightarrow$ $A$ 与 $B$ 互不影响

$$
\begin{aligned}
&\Longleftrightarrow P(B \mid A) = P(B) \\
&\Longleftrightarrow P(AB) = P(A)P(B)
\end{aligned}
$$

$A$ 与 $B$ 独立 $\Longleftrightarrow$ $\overline{B}$ 与 $A$，$\overline{B}$ 与 $\overline{A}$，$B$ 与 $\overline{A}$ 独立。

$$
\Longleftrightarrow P(\overline{B} \mid A) = P(\overline{B})
$$

### 2. 古典概率求概率

$$
P(A)=\frac{A\text{ 中可能的点数}}{\Omega\text{ 中可能的点数}}
$$

- 排列：$A$
- 组合：$C$

记住：分步相乘，分类相加。

### 3. 全概率公式与贝叶斯公式

题目形式：一般一个试验分为两个阶段完成。

#### ① 全概率公式

$$
\begin{aligned}
P(A) &= P(AB_1 \cup AB_2 \cup AB_3) \\
&= P(AB_1) + P(AB_2) + P(AB_3) \\
&= P(B_1)\cdot P(A\mid B_1) + P(B_2)P(A\mid B_2) \\
&\quad + P(B_3)\cdot P(A\mid B_3)
\end{aligned}
$$

![全概率示意图](/images/posts/probability-notes/total-probability-diagram.svg)

其中

$$
\left\{
\begin{aligned}
&B_1 \cup B_2 \cup B_3 = \Omega \\
&B_1, B_2, B_3 \text{ 两两互斥}
\end{aligned}
\right\}
$$

$\Rightarrow$ $B_1, B_2, B_3$ 为 $\Omega$ 的一个完备事件组。

#### ② 贝叶斯公式

$$
P(B_1\mid A)
=\frac{P(AB_1)}{P(A)}
=\frac{P(B_1)\cdot P(A\mid B_1)}{\text{全概率公式}}
$$

这类题型解题步骤：

1°. 把第一阶段所有可能结果看成完备组 $B_1, B_2, B_3$。

2°. 把第二阶段的某个可能结果看成 $A$。

3°. 用公式。

关键点：对第一阶段的所有可能要讨论完备。

### 4. 伯努利概型求概率

关键信息：“独立”、“$n$ 重试验”、“两种结果”。

$$
P_n(k)=C_n^k\cdot p^k\cdot(1-p)^{n-k}
$$

其中 $p=P(A)$、$1-p=P(\overline{A})$。

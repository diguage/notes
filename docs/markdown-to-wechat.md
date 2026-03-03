---
title: 使用 wenyan-cli 从 Markdown 直发微信公众号
cover: ./wenyan-cli.png
author: D瓜哥
---

今天发现一个工具，可以从 Markdown 直接发布到微信公众号。正好写文验证及分享一下。

# 获取 AppID 和 AppSecret

登录 [微信开发者平台](https://developers.weixin.qq.com/platform) ，点击“公众号”，右上角选择要发布的公众号，就可以看到 `AppID` 和 `AppSecret`，保存下来，通过如下两行命令设置成系统变量。

```bash
export WECHAT_APP_ID="wxc************"
export WECHAT_APP_SECRET="50403***************e441ed"
```

# 下载安装 wenyan-cli

wenyan-cli 是基于 Node 的工具，所以，需要提前安装 Node 和 npm。

```bash
# 安装 wenyan-cli 之前，需要先装好 npm
npm install -g @wenyan-md/cli

# 安装后，验证是否安装成功
wenyan --help
```

# 书写 Markdown 格式的文章

除了完整的 Markdown 格式的内容外，还需要在文章顶部增加 frontmatter，示例如下：

```
---
title: 文章标题（必填！）
cover: 封面图片路径（必填！）
author: 作者（选填）
source_url: 原文地址（选填）
---

// 以下是文章正文

# 一级标题

第一节内容

......
```

# 发布指南

通过 wenyan-cli 可以指出微信公众号，流程如下：

![wenyan-cli](wenyan-cli.png)

通过如下命令进行发布：

```bash
wenyan publish -f markdown-to-wechat.md -t lapis -h solarized-light --no-mac-style
```

wenyan-cli 内置了几种主题：[内置主题 | 文颜](https://yuzhi.tech/docs/wenyan/theme)，感兴趣可以尝试一下不同的主题。

> 友情提醒：发布之前，需要在 [微信开发者平台](https://developers.weixin.qq.com/platform) 设置 IP 白名单。

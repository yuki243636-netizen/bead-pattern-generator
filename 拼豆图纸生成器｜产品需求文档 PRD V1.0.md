# 拼豆图纸生成器｜产品需求文档 PRD V1.0

## 01｜项目概述

### 1.1 产品名称

**Perler Pattern Generator**

中文名称：**拼豆图纸生成器**

产品定位：

> 一款基于 Web 的拼豆图纸生成工具。用户上传参考图片，选择拼豆品牌及色卡，系统自动进行图像分析、邻近色匹配和网格化处理，生成可直接用于拼豆制作的高清图纸，并自动统计所需拼豆数量，同时提供缺色替换建议。

---

### 1.2 产品形态

产品采用：

**Responsive Web UI + PWA**

支持：

- iPhone
- Android 手机
- iPad
- Android 平板
- Desktop Web

产品不需要：

- 用户注册
- 用户登录
- 数据库
- 用户中心
- 云端项目保存
- 在线支付

核心使用方式：

> 打开网址 → 上传图片 → 设置参数 → 生成图纸 → 调整 → 下载

---

# 02｜产品核心目标

产品需要解决用户制作拼豆图纸过程中最复杂的几个问题：

### 目标 1｜图片转拼豆图纸

用户上传一张普通图片，自动转换成：

> 像素化 + 拼豆颜色匹配 + 网格图纸

---

### 目标 2｜自动匹配拼豆颜色

系统根据用户选择的品牌色卡：

> 图片颜色 → 分析 → 匹配最接近的拼豆颜色

并显示：

- 色卡编号
- 颜色名称
- HEX
- RGB
- 使用数量

---

### 目标 3｜控制图纸尺寸

用户可以设置：

- 画板宽度
- 画板高度
- 拼豆尺寸
- 是否保持比例
- 是否自动计算尺寸

---

### 目标 4｜自动统计拼豆数量

生成图纸以后自动统计：

> 每种颜色需要多少颗拼豆

同时提供：

- 总豆子数量
- 各颜色数量
- 色卡编号
- 颜色名称
- 占比

---

### 目标 5｜缺色替换

当用户实际拥有的色卡缺少某种颜色时：

系统可以根据色差自动推荐：

> 最接近的可替换颜色

例如：

**Original**

Dark Blue  
#1E4E8C

↓

**Recommended Replacement**

Blue  
#245A91

并显示：

> Color Difference: Low

---

# 03｜核心用户流程

整个产品的核心流程：

```text
打开工具
   ↓
上传参考图片
   ↓
选择拼豆品牌
   ↓
选择画板尺寸
   ↓
设置拼豆大小
   ↓
选择颜色匹配模式
   ↓
生成图纸
   ↓
查看拼豆图纸
   ↓
查看颜色统计
   ↓
查看缺色替换
   ↓
调整参数
   ↓
重新生成
   ↓
下载图纸
```

---

# 04｜首页 / 工作台

首页不需要复杂的营销内容。

产品应该直接进入工具。

视觉方向：

> Minimal / Premium / Clean / Professional

建议整体采用：

- 大面积留白
- 浅色背景
- 深色文字
- 低饱和辅助色
- 圆角卡片
- 轻微阴影
- 简洁线性 Icon
- 高质量排版
- 减少装饰性元素

避免：

- 大量渐变
- 高饱和颜色
- 卡通化 UI
- 复杂背景
- 过多按钮
- 过多信息同时出现

---

# 05｜页面结构

## Desktop / iPad

建议采用：

```text
┌─────────────────────────────────────────────┐
│ Logo                    Help     Download   │
├──────────────┬──────────────────────────────┤
│              │                              │
│  SETTINGS    │                              │
│              │                              │
│ Image        │        CANVAS                │
│              │                              │
│ Canvas       │                              │
│              │                              │
│ Bead Size    │                              │
│              │                              │
│ Color        │                              │
│ Palette      │                              │
│              │                              │
│ Generate     │                              │
│              │                              │
├──────────────┴──────────────────────────────┤
│ Color Statistics / Bead Count / Replacement │
└─────────────────────────────────────────────┘
```

---

# 06｜Mobile UI

手机端不能简单缩小 Desktop UI。

需要采用：

**单列 / Bottom Sheet / Tab**

结构。

推荐：

```text
┌─────────────────────┐
│ ☰   Pattern    ↓    │
├─────────────────────┤
│                     │
│                     │
│      CANVAS         │
│                     │
│                     │
│                     │
├─────────────────────┤
│ Grid   Colors   Info │
├─────────────────────┤
│                     │
│  Generate Pattern   │
│                     │
└─────────────────────┘
```

参数设置可以通过：

> Bottom Sheet

从底部向上展开。

---

# 07｜图片上传

## 7.1 支持方式

用户可以：

- 点击上传
- 拖拽上传（Desktop）
- 手机相册
- iPad 相册
- 文件选择

---

## 7.2 支持格式

建议支持：

- JPG
- JPEG
- PNG
- WEBP

---

## 7.3 图片上传后

显示：

- 图片预览
- 图片尺寸
- 文件大小
- 替换图片
- 删除图片

---

# 08｜图片处理

图片上传以后进行：

### Step 1

读取原始图片。

### Step 2

根据画板尺寸进行缩放。

### Step 3

进行像素化处理。

### Step 4

根据拼豆尺寸生成网格。

### Step 5

对每个像素进行颜色分析。

### Step 6

与用户选择的色卡进行颜色匹配。

### Step 7

生成最终拼豆图纸。

---

# 09｜画板设置

用户可以设置：

### Canvas Width

画板宽度。

例如：

- 16
- 32
- 48
- 64
- 96
- 128

单位：

**Beads**

---

### Canvas Height

画板高度。

支持：

**锁定比例**

如果开启：

> 修改 Width → Height 自动调整

---

### 自定义尺寸

允许用户输入：

> 1–300 beads

建议 V1.0 对最大尺寸进行限制，避免浏览器处理过大的图片造成性能问题。

---

# 10｜拼豆尺寸

支持：

### Mini

Mini Beads

### Standard

Standard Beads

### Large

Large Beads

UI 不直接展示复杂技术参数，而采用：

```text
Bead Size

○ Mini
● Standard
○ Large
```

后续可以在 Help 中说明具体尺寸。

---

# 11｜品牌色卡

用户可以选择不同品牌色卡。

界面：

```text
Color Palette

[ Select Brand ▼ ]

Perler
Hama
Artkal
Other
```

系统必须采用**独立色卡数据结构**。

不要把品牌颜色写死在前端代码中。

建议：

```text
Palette
 ├── Brand
 ├── Color ID
 ├── Color Name
 ├── HEX
 ├── RGB
 └── Optional Image / Metadata
```

这样未来增加品牌时，不需要重写颜色匹配算法。

---

# 12｜颜色匹配算法

系统需要实现：

**Nearest Color Matching**

即：

> 将图片中的实际颜色，与选定色卡中的所有颜色进行距离计算，选择最接近的颜色。

V1.0 推荐优先采用：

**RGB → Lab 色彩空间 → Delta E**

而不是简单比较 RGB 数值。

目标：

> 让最终拼豆颜色在视觉上尽可能接近原始图片。

---

# 13｜颜色匹配模式

建议提供两种模式。

### Standard

系统自动选择最接近颜色。

适合普通用户。

---

### Limited Colors

用户指定最大颜色数量。

例如：

```text
Max Colors

[ 12 ]
```

系统自动从色卡中选择最合适的 12 种颜色。

这样可以避免最终图纸颜色过多。

---

# 14｜图纸生成

生成以后，核心 Canvas 显示：

### Grid

每一个拼豆对应一个格子。

例如：

```text
┌───┬───┬───┬───┐
│ A │ A │ B │ B │
├───┼───┼───┼───┤
│ A │ C │ C │ B │
├───┼───┼───┼───┤
│ A │ C │ D │ B │
└───┴───┴───┴───┘
```

---

# 15｜图纸显示模式

建议提供：

### Pattern

标准拼豆图纸。

显示：

- 网格
- 颜色
- 坐标

---

### Preview

模拟最终拼豆效果。

显示：

- 圆形/方形拼豆
- 实际颜色
- 无辅助网格

---

### Split View

如果设备空间足够：

```text
Original Image
      ↕
Pattern
```

方便用户对照。

---

# 16｜图纸交互

用户可以：

- Zoom In
- Zoom Out
- Fit to Screen
- Reset
- Pan
- Show Grid
- Hide Grid
- Show Coordinates

iPad 需要支持：

**Pinch to Zoom**

手机同样支持：

**双指缩放 / 拖动**

---

# 17｜颜色统计

生成图纸以后显示：

## Color Summary

例如：

```text
Total Beads

1,284
```

下面显示：

| Color | ID | Count |
|---|---|---:|
| Black | 001 | 325 |
| White | 002 | 281 |
| Red | 015 | 164 |
| Blue | 032 | 129 |

每种颜色显示：

- 色块
- 颜色名称
- 色卡编号
- 数量
- 百分比

按照：

**数量从高到低**

排序。

---

# 18｜缺色替换

用户可以进入：

**Color Replacement**

系统识别当前图纸使用的颜色。

用户可以标记：

> I Don't Have This Color

然后系统自动寻找最接近的替代色。

显示：

```text
Original

● Dark Blue
ID: 032
Qty: 126

        ↓

Recommended

● Blue
ID: 041
Qty: 126

Color Difference
Low
```

---

## 18.1 替换规则

优先：

1. 色差最小
2. 同品牌色卡
3. 用户已有颜色
4. 避免使用过于接近但视觉明显不同的颜色

---

## 18.2 批量替换

支持：

**Replace All**

例如：

> 将所有缺少的颜色自动替换成推荐颜色。

同时允许：

**Undo**

撤销替换。

---

# 19｜图纸下载

用户可以下载：

### PNG

适合：

- 手机查看
- 打印
- 分享

---

### PDF

适合：

- 打印
- 实际制作

PDF 建议包含：

**Page 1**

完整图纸。

**Page 2**

颜色统计。

**Page 3**

拼豆数量清单。

---

# 20｜PDF 图纸结构

建议：

```text
PERLER PATTERN

Pattern Name
Canvas: 32 × 32
Bead Size: Standard
Palette: Perler

────────────────

[ PATTERN ]

────────────────

COLOR SUMMARY

Color   ID   Qty

Black   001  325
White   002  281
Red     015  164

────────────────

Total: 1,284 beads
```

---

# 21｜下载选项

下载按钮点击后显示：

```text
Download

○ PNG
○ PDF

[ Download ]
```

高级选项：

```text
☑ Include Color Legend
☑ Include Grid
☑ Include Coordinates
☑ Include Bead Count
```

---

# 22｜数据处理原则

因为产品：

> 无登录 + 无数据库

所以默认：

**所有数据只存在于当前浏览器 Session / 内存中。**

用户关闭页面以后：

> 不保证数据永久保存。

不需要建立用户账户。

不需要服务器保存用户图片。

---

# 23｜隐私原则

用户上传的图片属于用户个人数据。

第一版建议：

**尽可能在浏览器本地完成图片处理。**

即：

```text
用户图片
 ↓
浏览器
 ↓
Canvas / Image Processing
 ↓
生成图纸
 ↓
浏览器下载
```

而不是：

```text
用户图片
 ↓
上传服务器
 ↓
服务器处理
 ↓
返回结果
```

如果算法可以全部放在前端完成，这种方案更适合本产品。

优势：

- 更快
- 更省服务器成本
- 不需要数据库
- 不需要保存用户图片
- 隐私更好
- 可以离线使用部分功能

---

# 24｜PWA 要求

必须支持：

### Installable

用户可以：

> Add to Home Screen

---

### App Icon

需要：

- 192 × 192
- 512 × 512

PWA Icon。

---

### Manifest

包含：

- App Name
- Short Name
- Description
- Theme Color
- Background Color
- Icons
- Display Mode

建议：

```text
display: standalone
```

---

### Service Worker

实现：

- 静态资源缓存
- 基础离线访问
- 页面快速加载

---

# 25｜Responsive UI 要求

需要至少适配：

### Mobile

320px+

### Large Mobile

375px+

### Tablet

768px+

### iPad

820px+

### iPad Pro

1024px+

### Desktop

1280px+

### Large Desktop

1440px+

---

# 26｜响应式原则

不要简单：

> Desktop 缩小到 Mobile。

而应该：

### Desktop

Sidebar + Canvas + Information Panel

### iPad

Sidebar + Canvas

Information Panel 可以折叠。

### Mobile

Canvas 为核心。

所有设置进入：

**Bottom Sheet / Drawer**

---

# 27｜UI 视觉方向

关键词：

**Minimal**

**Premium**

**Clean**

**Technical**

**Professional**

**Modern**

---

## 27.1 色彩

建议：

### Background

Off White / Light Gray

### Primary

Near Black

### Secondary

Gray

### Accent

使用非常克制的品牌强调色。

不要使用大量颜色作为 UI 装饰。

真正的颜色应该来自：

> 拼豆图纸本身。

---

# 28｜字体

建议使用现代无衬线字体。

优先：

**Inter**

或者：

**Manrope**

中文环境可以使用：

**Noto Sans SC**

字体层级需要明显：

```text
H1
32–40px

H2
20–24px

Body
14–16px

Caption
12–13px
```

---

# 29｜按钮系统

主要按钮：

**Generate Pattern**

次级按钮：

**Upload Image**

**Download**

**Replace Colors**

辅助按钮：

**Reset**

**Undo**

**Redo**

避免同时出现大量 Primary Button。

---

# 30｜Loading 状态

图片处理过程中必须显示进度。

例如：

```text
Generating Pattern...

Analyzing Image       ✓
Matching Colors       ✓
Building Grid         ●
Preparing Preview      ○
```

不要只显示：

> Loading...

---

# 31｜错误状态

需要处理：

### 图片太大

提示：

> Image is too large. Please choose a smaller image.

### 图片格式不支持

> Unsupported image format.

### 图片尺寸异常

> Unable to process this image.

### 浏览器性能不足

> This pattern is too large for your device. Try reducing the canvas size.

---

# 32｜撤销 / 重做

至少支持：

**Undo**

**Redo**

尤其是：

- 修改画板尺寸
- 更换色卡
- 缺色替换

---

# 33｜性能要求

这是本项目非常重要的一部分。

因为：

> 图片 × 像素 × 色卡匹配

可能产生大量计算。

因此：

### V1.0

建议限制：

**Maximum Canvas**

300 × 300 beads。

实际默认推荐：

**32 × 32**

或：

**64 × 64**

---

如果需要处理更大的图纸：

可以后续使用：

**Web Worker**

将颜色计算放到后台线程。

避免 UI 卡顿。

---

# 34｜技术架构建议

推荐：

```text
Frontend

Next.js / React
        ↓
TypeScript
        ↓
Tailwind CSS
        ↓
Responsive UI
        ↓
PWA
```

图像处理：

```text
HTML Canvas
        +
Image Processing
        +
Color Matching
```

计算：

```text
Web Worker
```

用于大型图纸处理。

---

# 35｜数据结构

色卡不要写死。

建议：

```text
Palette
{
  brand: "Perler",

  colors: [
    {
      id: "001",
      name: "Black",
      hex: "#000000",
      rgb: [0,0,0]
    }
  ]
}
```

未来可以增加：

```text
Perler
Hama
Artkal
Other
```

---

# 36｜核心功能优先级

## P0｜第一版必须完成

- [ ] 图片上传
- [ ] 图片预览
- [ ] 画板尺寸设置
- [ ] 拼豆尺寸设置
- [ ] 色卡选择
- [ ] 自动颜色匹配
- [ ] 图纸生成
- [ ] 网格显示
- [ ] 图纸缩放
- [ ] 拼豆数量统计
- [ ] PNG 下载
- [ ] PDF 下载
- [ ] Responsive UI
- [ ] 手机适配
- [ ] iPad 适配
- [ ] PWA

---

## P1｜第一版重要增强

- [ ] Preview Mode
- [ ] Color Replacement
- [ ] Replace All
- [ ] Undo / Redo
- [ ] Coordinates
- [ ] Color Legend
- [ ] Limited Colors
- [ ] Split View
- [ ] Web Worker

---

## P2｜未来功能

- [ ] 更多品牌色卡
- [ ] 自定义色卡
- [ ] 用户自己的库存颜色
- [ ] 自动推荐最佳配色
- [ ] 图片背景去除
- [ ] 图片裁剪
- [ ] 图片亮度调整
- [ ] 图片对比度调整
- [ ] 图片饱和度调整
- [ ] 图纸局部编辑
- [ ] 手动修改单颗拼豆颜色
- [ ] 图纸编号系统
- [ ] 图纸分享链接
- [ ] 社区图纸

---

# 37｜第一版产品边界

V1.0 必须坚持：

> **简单、快速、无需登录、打开即用。**

不做：

- 用户系统
- 数据库
- 社交系统
- 云端项目管理
- 在线商城
- 复杂图片编辑
- 复杂 AI 功能

核心体验只有：

**Upload → Configure → Generate → Check → Download**

---

# 38｜最终产品体验

用户打开网址：

```text
┌──────────────────────────────┐
│       PERLER PATTERN         │
│                              │
│       Create Your Pattern    │
│                              │
│     [ Upload Your Image ]    │
│                              │
└──────────────────────────────┘
```

上传图片：

```text
Image
↓
Canvas Size
↓
Bead Size
↓
Color Palette
↓
Generate Pattern
```

生成：

```text
┌──────────────────────────────┐
│                              │
│       PIXEL PATTERN          │
│                              │
│    ■ ■ ■ □ □ ■ ■             │
│    ■ ■ □ □ □ ■ ■             │
│    ■ □ □ ■ □ □ ■             │
│                              │
└──────────────────────────────┘
```

下面：

```text
1,284 BEADS

12 COLORS

[ Color Summary ]

[ Color Replacement ]

[ Download PNG ]

[ Download PDF ]
```

整个产品围绕一个核心原则：

> **让用户用最少的操作，把一张图片变成可以真正拿来制作的拼豆图纸。**

---

# 39｜核心成功指标

第一阶段不以流量和用户注册量为核心。

更应该关注：

### 核心指标

**Image → Pattern 成功率**

**Pattern Generation Time**

**Download Success Rate**

**Color Matching Accuracy**

**Mobile Usability**

**iPad Usability**

---

# 40｜V1.0 产品定位总结

### 产品

**A simple and powerful bead pattern generator.**

### 核心价值

> **Turn any image into a bead pattern.**

### 核心体验

> **Upload → Match → Generate → Count → Replace → Download**

### 产品特征

**Free**

**No Login**

**No Account**

**No Database**

**Browser Based**

**PWA**

**Mobile Friendly**

**iPad Friendly**

**Privacy First**

### UI 风格

**Minimal · Premium · Clean · Professional**

---

# 41｜开发原则

开发过程中必须遵循：

1. Mobile First
2. Responsive by Default
3. Component Based
4. TypeScript
5. Accessibility
6. Performance First
7. Local Processing First
8. No unnecessary backend
9. No user account system
10. No database
11. PWA Ready
12. Color palette data must be modular
13. Image processing must be separated from UI
14. Color matching algorithm must be replaceable
15. UI and core processing logic must be decoupled

最终代码结构应确保未来可以方便增加：

> 新色卡 / 新算法 / 新图纸格式 / 新导出方式

而无需重构整个项目。
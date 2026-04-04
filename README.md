# Image Background Remover

一键去除图片背景的在线工具，基于 Remove.bg API，部署在 Cloudflare Pages。

## 技术栈

- **前端：** Next.js 15 + Tailwind CSS
- **API：** Next.js Route Handler（Edge Runtime）
- **去背景能力：** Remove.bg API
- **部署：** Cloudflare Pages

## 本地开发

1. 克隆项目

```bash
git clone https://github.com/lanwis2025/image-background-remover.git
cd image-background-remover
```

2. 安装依赖

```bash
npm install
```

3. 配置环境变量

```bash
cp .env.local.example .env.local
# 编辑 .env.local，填入你的 Remove.bg API Key
```

4. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

## 环境变量

| 变量名 | 说明 |
|--------|------|
| `REMOVE_BG_API_KEY` | Remove.bg API Key，在 https://www.remove.bg/api 获取 |

## 部署到 Cloudflare Pages

1. Fork 本仓库
2. 在 Cloudflare Pages 新建项目，连接 GitHub 仓库
3. 构建配置：
   - Framework preset: `Next.js`
   - Build command: `npm run build`
   - Output directory: `.next`
4. 在环境变量中设置 `REMOVE_BG_API_KEY`
5. 部署完成

## 功能

- ✅ 拖拽或点击上传图片（JPG/PNG/WebP，最大 10MB）
- ✅ AI 自动去除背景
- ✅ 原图与结果对比预览
- ✅ 一键下载透明底 PNG
- ✅ 图片仅在内存处理，不落盘存储
- ✅ API Key 安全存储在服务端环境变量

## MVP 需求文档

详见 [MVP需求文档](./image-bg-remover-mvp.md)

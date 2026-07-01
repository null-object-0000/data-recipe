# DataRecipe

**中文名：AI 有数**

Turn web page queries and API responses into reusable data recipes for AI agents.

将网页查询和 API 响应沉淀为 AI Agent 可复用的数据配方。

## Languages

* [中文说明](./README.zh-CN.md)
* [English README](./README.en.md)

## MVP quick start

```bash
pnpm install
pnpm build:extension
```

Load `apps/extension/dist` as an unpacked extension in Chrome, open `docs/test-page.html`, open the DataRecipe side panel, click "开始发现", trigger the fetch or XHR test request, then confirm the generated Data Skill Package and export the `.data-skill.json` file.


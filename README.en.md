# DataRecipe

**Chinese name: AI 有数**

Operate once. Generate reusable data recipes for AI agents.

DataRecipe turns web page queries, API responses, query parameters, pagination rules, and field meanings into reusable data recipes.
Any AI agent can later use these recipes to collect, organize, and analyze data.

## Why DataRecipe

Many web pages and internal admin systems contain useful data, but the data is often hidden behind search forms and API responses.

Non-technical users often face these problems:

* Data can only be checked page by page;
* Admin systems lack flexible reporting features;
* Temporary analysis depends on developers or data teams;
* AI agents do not know where the data is or how to query it;
* The same query process has to be repeated manually.

DataRecipe aims to solve this:

> Operate once, and AI agents will know how to query, organize, and analyze the data next time.

## What is a Data Recipe?

A Data Recipe is a reusable instruction package for AI agents.

It describes:

* where the data comes from;
* how to query the data;
* what query parameters are supported;
* how pagination works;
* what fields are returned;
* what the fields mean;
* what analysis can be performed;
* how this data can be connected with other pages or systems.

A Data Recipe is not a one-time scraping result.
It is a reusable data capability.

## Core Idea

DataRecipe is API-first.

It prefers collecting structured data from API responses instead of extracting visible text from the DOM.

The DOM can still help with understanding:

* which button triggers a query;
* which form fields map to query parameters;
* which table columns map to response fields;
* how pagination controls affect API parameters.

But the final reusable capability is built around API responses.

## Goals

The first version focuses on:

1. Detecting API requests from the current web page;
2. Identifying useful data APIs;
3. Understanding request parameters, response fields, and pagination rules;
4. Generating reusable Data Recipes;
5. Replaying recipes locally with the user's current browser session;
6. Helping AI agents collect, summarize, and analyze data based on recipes.

## What DataRecipe is not

DataRecipe is not a general-purpose crawler.
It is not an anti-bot bypass tool.

DataRecipe does not aim to:

* bypass login permissions;
* solve captchas;
* crack dynamic signatures;
* bypass risk-control systems;
* perform high-frequency scraping;
* collect unauthorized data.

DataRecipe is designed for data that the user is already authorized to access.

## Use Cases

* Internal admin data queries;
* Product and operations data analysis;
* Temporary business reporting;
* Multi-page data combination;
* Low-frequency public web data collection;
* Reusable data tools for AI agents;
* Turning legacy admin pages into AI-usable data capabilities.

## Example

A user operates once on an order list page:

1. Selects a date range;
2. Clicks search;
3. Goes to the next page;
4. DataRecipe detects the underlying order query API;
5. DataRecipe generates an Order Data Recipe.

Later, the user can ask an AI agent:

* Calculate last week's GMV;
* Summarize orders and revenue by project;
* Find projects with abnormal refund rates;
* Export paid orders from the last 7 days;
* Combine orders, projects, and reservations to analyze conversion.

## Project Status

This project is in the early exploration stage.

Current focus:

* API detection stability;
* Data API identification accuracy;
* Data Recipe format design;
* Real-world AI agent analysis based on generated recipes.

## Planned Structure

```text
data-recipe/
├── apps/
│   └── extension/          # Browser sidebar extension
├── packages/
│   ├── detector/           # API request detection
│   ├── recipe-core/        # Core Data Recipe model
│   ├── recipe-runner/      # Recipe runtime
│   └── recipe-exporter/    # MCP / OpenAPI / JSON exporter
├── docs/
│   ├── vision.md
│   ├── data-recipe-spec.md
│   └── examples.md
├── README.md
├── README.zh-CN.md
└── README.en.md
```

## License

TBD

## Run the MVP locally

### Install dependencies

```bash
pnpm install
```

### Build the browser extension

```bash
pnpm build:extension
```

The extension output is:

```text
apps/extension/dist
```

### Load it in Chrome

1. Open `chrome://extensions`;
2. Enable Developer mode;
3. Click "Load unpacked";
4. Select `apps/extension/dist`;
5. Click the "AI 有数" extension icon to open the side panel.

### Manual verification

1. Open `docs/test-page.html`;
2. Click "开始发现" in the side panel;
3. Click the fetch or XHR test button on the test page;
4. The side panel should show the discovered data source count, URL, method, status, query data, and response preview;
5. Expand "高级信息" to inspect the minimal Data Recipe draft JSON.

You can also start discovery on any page you are authorized to access and then trigger a page query. This MVP only performs low-frequency local detection. It does not bypass login, captchas, risk controls, or dynamic signatures.

### Development mode

```bash
pnpm dev:extension
```

This watches and rebuilds `apps/extension/dist`. Refresh the unpacked extension in Chrome before testing updated code.

### Export a Data Skill Package

After one discovery flow, use the side panel to:

1. Fill in the data skill name and purpose;
2. Confirm or rename returned fields;
3. Check "试运行结果" to confirm data can be read;
4. Check "技能包预览" to confirm required files are present;
5. Click "导出技能包".

The current MVP downloads a `.data-skill.json` file. This is a temporary text package format containing:

```text
packageName
files[]
  SKILL.md
  recipe.json
  examples.md
  README.md
```

A later version can export a real folder or zip. For now, the JSON text package validates the generate, test, and export loop.

### Data Skill Package acceptance checks

An exported package should at least:

* Include `SKILL.md`, `recipe.json`, `examples.md`, and `README.md`;
* Use `SKILL.md` to explain what the data skill is useful for;
* Use `recipe.json` to hold the data source, query inputs, returned fields, and test-run information;
* Show a data preview in the side panel test-run result;
* Show no missing required files before export.

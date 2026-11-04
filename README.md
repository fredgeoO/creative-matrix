# 格致矩阵 · Gezhi Matrix

[中文](README.zh.md) · [English](README.en.md) · [日本語](README.ja.md)

> 格物致知。把任意两个维度排成一张网格，在每一个交叉点上「即物穷理」，逐格生成一份推演。
>
> *Investigate things to extend knowledge. Arrange any two dimensions into a grid, and generate one reasoning report per cell — investigating each thing to exhaust its principle at every intersection.*
>
> *「格物致知」——任意の二次元元をグリッドに並べ、各交点で「即物窮理」し、マスごとに推論レポートを生成します。*

**English.** Place the two axes on a 2-D grid — the axes can be anything: mental models, scenario constraints, characters, timelines, hexagrams… Click each intersection to generate a reasoning report with the current model, saved to `data/matrix.json` in the workspace.

**日本語。** 縦軸と横軸を二次元グリッドに配置します——軸は何でも構いません：思考モデル、シナリオ制約、キャラクター、タイムライン、卦象……。各交点をクリックすると、現在のモデルで推論レポートが生成され、ワークスペースの `data/matrix.json` に保存されます。

## 这是什么 / What it is / 概要

| | 中文 | English | 日本語 |
|---|---|---|---|
| **定位** | DSH（DeepSeek Harness）插件：纵横两轴交叉的逐格推演面板 | A DeepSeek Harness plugin: a cell-by-cell reasoning panel built from two crossed axes | DSH（DeepSeek Harness）プラグイン：縦横二軸の交点ごとに推論を生成するパネル |
| **方法** | 立格 → 交错 → 穷理 → 验伪；每格必须写「什么情况下会失效」，deep 模式再跑一轮独立红队 | Set the axes → cross them → reason mechanism → consequence → falsify; every cell ends with "when this fails", and deep mode adds an independent red-team pass | 軸を立てる → 交差させる → 機構から帰結を推演 → 反証する。各マスは「何が機能しない場合か」で締め、deep モードでは独立したレッドチーム検証が追加されます |
| **产出** | Markdown 格子报告，自动保存到 `data/matrix.json`；模板存为 `presets/*.md` | Markdown cell reports auto-saved to `data/matrix.json`; templates saved as `presets/*.md` | Markdown 形式のレポートは `data/matrix.json` に自動保存、テンプレートは `presets/*.md` に保存 |
| **内置模板** | 7 套：日常创意 / 未来研判 / 格栅理论 / 故事创作 / 人生规划 / 易经卦象 / 禅宗道理 | 7 built-ins: everyday ideas, future forecasting, latticework theory, story craft, life planning, I Ching hexagrams, Zen | 内蔵テンプレート 7 種：日常アイデア、未来予測、ラティスワーク理論、物語創作、人生設計、易経の卦、禅 |
| **接口** | HTTP API `/creative-matrix/api` + Agent 工具 `creative_matrix` | HTTP API `/creative-matrix/api` + the `creative_matrix` agent tool | HTTP API `/creative-matrix/api` とエージェントツール `creative_matrix` |

## 名字 / The name / 名前

- **中文**：**格致**是「格物致知」的缩写。**格**双关——既是矩阵里一格一格的格子，也是「格物」里推究、穷究的动作；**致**是抵达，**知**是认知。它原名「创意矩阵」：「创意」描述产出，「格致」描述方法，而这个插件稀缺的是方法。名字里自带警告——格出来的可能是漂亮的推演，不一定是真知。
- **English**: **Gezhi** (格致) abbreviates 格物致知 — "investigate things to extend knowledge". 格 puns on both the grid's cells and the act of exhaustive inquiry; 致 is arrival, 知 is knowledge. It was formerly "Creative Matrix": *creative* names the output, *gezhi* names the method — and the method is what this plugin is actually about. The name carries its own warning: a cell may yield elegant reasoning rather than true knowledge.
- **日本語**：**格致（ゲチ）**は「格物致知」の略で、「物を究めて知を致す」の意味。格はグリッドのマス目と「究明する行為」の掛詞、致は到達、知は知識を指します。旧名は「創造マトリクス（Creative Matrix）」——*creative* は成果物を、*gezhi* は手法を表し、このプラグインの価値は手法にあります。名前自体が警告を含みます：導き出されるのは洗練された推論であって、真の知とは限らない、ということです。

## 快速开始 / Quick start / クイックスタート

```powershell
# 在 Harness 里（需要 Full access 或逐次批准）/ In Harness (Full access or per-prompt approval)
# plugin_manager install_bundle target = 本目录的绝对路径 / absolute path of this directory
```

- **中文**：安装后刷新一次页面，侧边栏出现「格致矩阵」图标；默认打开「模板」标签，选一套内置模板载入即可逐格生成。
- **English**: Reload the page once after installing; a "Gezhi Matrix" icon appears in the sidebar. The Templates tab opens by default — load any built-in template and start generating cells.
- **日本語**：インストール後、ページを一度更新するとサイドバーに「格致マトリクス（格致矩阵）」アイコンが表示されます。既定でテンプレートタブが開くので、内蔵テンプレートを読み込めば各マスの生成を始められます。

## 文档 / Documentation / ドキュメント

完整说明以中文为准，含功能清单、文件结构、数据模型、模板与预设、生成提示词与占位符、批量生成、HTTP API、Agent 工具、配置、安装/升级、测试与设计说明：

- 🇨🇳 [README.zh.md](README.zh.md) — 格致矩阵（原文 / source of truth）
- 🇬🇧 [README.en.md](README.en.md) — Gezhi Matrix (English)
- 🇯🇵 [README.ja.md](README.ja.md) — 格致マトリクス（日本語）

Also in the repo: `plugins/creative-matrix/`（插件源码 / plugin source）、`presets/gezhimatrix.md`（默认预设 / default preset）、`data/matrix.json`（当前矩阵数据 / current matrix data）。

## 引用 / References / 出典

1. 《礼记·大学》：「致知在格物。」「物格而后知至。」
2. 朱熹《四书章句集注·大学章句》补格物致知传：「所谓致知在格物者，言欲致吾之知，在即物而穷其理也。」
3. 王阳明《传习录》下卷（黄以方录）：亭前格竹，「天下之物本无可格者，其格物之功只在身心上做。」
4. 晚清以「格致」译 science，傅兰雅主编《格致汇编》（1876，上海）。

> 第 4 条只解释「格致」一词在近代的用法，不表示本插件等同于科学方法。
> *Item 4 only documents the modern usage of the word "gezhi"; it does not claim this plugin is equivalent to the scientific method.*
> *第 4 項は「格致」という語の近代的用法を示すものであり、本プラグインが科学的方法と同等だと主張するものではありません。*

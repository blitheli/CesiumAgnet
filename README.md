
------------------------------
## 1. 核心需求回顾

* 应用背景：一个基于 Cesium 的卫星/地面站可视化平台。
* 核心目标：
1. AI 驱动：通过自然语言指令（Agent）自动调用 Cesium API 创建实体。
   2. 即时响应：用户在网页窗口输入，视图立即更新。
   3. 二次开发：支持用户通过 Python 脚本远程驱动网页视图，实现自动化操控。

## 2. 总体架构设计：指令总线模式 (Command Bus)
为了同时兼顾 Agent 的即时性 和 Python 的远程控制，建议采用 SignalR 作为统一指令总线 的架构。

* 指令中心 (Server)：ASP.NET Core SignalR Hub，负责指令的校验与分发。
* 显示终端 (Web Client)：Cesium 网页。它只负责监听指令并执行可视化渲染。
* 指令源 (Drivers)：
* Agent：解析用户自然语言，生成 JSON 指令发给 Hub。
   * Python SDK：用户编写的脚本，通过 SignalR 协议连接 Hub。

------------------------------
## 3. 技术路径与实现细节## 第一阶段：定义标准化指令集 (Protocol)
首先定义一套标准的 JSON 格式（Schema），确保 Agent 输出和 Python 脚本输入的参数完全一致。

* 示例 JSON：

{
  "action": "createSatellite",
  "params": { "id": "SAT-01", "name": "Starlink", "orbit": { ... } }
}


## 第二阶段：构建 SignalR 中转 Hub (Backend)
在后端创建一个 Hub，提供一个方法供指令源调用，并将其转发给特定的网页端。

* 关键逻辑：使用 Clients.User(userId) 或 Clients.Group(sessionId) 来确保 Python 脚本控制的是正确的网页窗口。

## 第三阶段：前端 Cesium 执行器 (Receiver)
网页端通过 SignalR 监听事件，并在接收到 JSON 后分发给对应的 Cesium 接口。

* 实现方式：

connection.on("ReceiveCommand", (data) => {
    const { action, params } = data;
    if (action === "createSatellite") {
        cesiumAPI.createSatellite(params); // 调用你现有的 Cesium 渲染接口
    }
});


## 第四阶段：多源驱动实现

   1. Agent 驱动（即时指令）：
   * 在网页 UI 中集成聊天框。
      * 大模型（LLM）通过 Function Calling 生成上述标准的 JSON。
      * 前端收到 JSON 后，既可以直接调用 Cesium 接口，也可以通过 Hub 同步给其他观察者。
   2. Python 驱动（二次开发）：
   * 用户使用 signalrcore 库编写 Python 脚本。
      * 脚本模拟成一个客户端，发送 SendCommand 请求到 Hub，从而远程控制浏览器里的 Cesium 场景。
   
------------------------------
## 4. 方案优势

   1. 逻辑解耦：Cesium 渲染逻辑在前端，业务控制逻辑在后端/脚本端，互不干扰。
   2. 兼容性强：一套 SignalR 接口同时服务于 AI 和 开发者脚本，维护成本低。
   3. 远程协同：支持“异地操控”，例如你在北京运行 Python 脚本，身在上海的客户可以在浏览器里看到卫星实时创建的效果。

## 5. 接下来可以进行的操作

* 定义规范：梳理你需要暴露给 Agent 和 Python 的所有 Cesium 操控接口。
* Hub 开发：搭建 ASP.NET Core 环境并配置 SignalR。
* Prompt 调优：为大模型编写 System Prompt，使其严格按照你的 JSON 格式输出。

您需要我针对“如何为用户封装一个简单的 Python 类库（SDK）”来调用这个 SignalR 接口提供代码示例吗？

------------------------------
## 6. 当前项目实现

本仓库已经包含一个最小可运行的 ASP.NET Core + SignalR + Cesium 原型：

* `SatelliteCommandBus.csproj`：ASP.NET Core Web 项目。
* `Program.cs`：注册 SignalR、CORS、静态文件和健康检查接口。
* `Hubs/CommandHub.cs`：提供 `JoinSession(sessionId)` 和 `SendCommand(command)`，按 `sessionId` 分组转发 `ReceiveCommand`。
* `Models/CesiumCommand.cs`：标准 JSON 指令模型，包含 `action`、`params`、`sessionId`。
* `wwwroot/`：Cesium 网页客户端，支持创建卫星、创建地面站、飞行定位和清空场景。
* `vercel.json`：用于将 `wwwroot` 作为静态 Cesium 前端部署到 Vercel。

### 本地运行

安装 .NET 8 SDK 后执行：

```bash
dotnet run
```

浏览器打开控制台输出的地址，例如 `http://localhost:5000`。网页会默认连接同源 SignalR Hub：`/hubs/commands`。

### 指令示例

```json
{
  "action": "createSatellite",
  "sessionId": "demo",
  "params": {
    "id": "SAT-01",
    "name": "Starlink Demo",
    "longitude": 116.391,
    "latitude": 39.907,
    "altitude": 550000,
    "color": "#00d4ff"
  }
}
```

### Vercel 部署说明

Vercel 配置会部署 `wwwroot` 静态 Cesium 页面。由于 ASP.NET Core SignalR Hub 需要运行在支持 .NET 的后端环境中，请将后端部署到 ASP.NET Core 主机后，通过以下方式让 Vercel 页面连接后端 Hub：

```text
https://your-vercel-app.vercel.app/?hubUrl=https://your-dotnet-host.example.com/hubs/commands
```

也可以在页面加载前设置：

```html
<script>
  window.CESIUM_COMMAND_HUB_URL = "https://your-dotnet-host.example.com/hubs/commands";
</script>
```

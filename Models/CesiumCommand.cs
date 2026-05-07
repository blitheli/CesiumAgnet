using System.Text.Json;

namespace SatelliteCommandBus.Models;

/// <summary>
/// 跨 Agent / Python / 网页 的标准指令载荷。
/// JSON 中可省略 <c>target</c>，反序列化后默认为 <c>entity</c>（作用于 Cesium Entity 等）。
/// </summary>
public sealed record CesiumCommand(
    string Action,
    JsonElement Params,
    string Target = "entity",
    string? SessionId = null
);

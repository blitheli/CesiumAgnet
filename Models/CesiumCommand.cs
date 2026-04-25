using System.Text.Json;

namespace SatelliteCommandBus.Models;

public sealed record CesiumCommand(
    string Action,
    JsonElement Params,
    string? SessionId = null);

using Microsoft.AspNetCore.SignalR;
using SatelliteCommandBus.Models;

namespace SatelliteCommandBus.Hubs;

public sealed class CommandHub : Hub
{
    public async Task JoinSession(string sessionId)
    {
        if (string.IsNullOrWhiteSpace(sessionId))
        {
            throw new HubException("sessionId is required.");
        }

        await Groups.AddToGroupAsync(Context.ConnectionId, sessionId);
        await Clients.Caller.SendAsync("SessionJoined", sessionId);
    }

    public async Task SendCommand(CesiumCommand command)
    {
        if (string.IsNullOrWhiteSpace(command.SessionId))
        {
            throw new HubException("command.sessionId is required.");
        }

        if (string.IsNullOrWhiteSpace(command.Action))
        {
            throw new HubException("command.action is required.");
        }

        await Clients.Group(command.SessionId).SendAsync("ReceiveCommand", command);
    }
}

using System.Collections.Concurrent;
using System.Threading.Channels;

namespace InventoryApp;

// Mỗi tab quản trị có một kênh riêng; khi có đơn mới thì phát tới tất cả tab.
public sealed class OnlineOrderNotifier
{
    private readonly ConcurrentDictionary<Guid, Channel<bool>> _subscribers = new();

    public (Guid Id, ChannelReader<bool> Reader) Subscribe()
    {
        var id = Guid.NewGuid();
        var channel = Channel.CreateBounded<bool>(new BoundedChannelOptions(1)
        {
            FullMode = BoundedChannelFullMode.DropOldest
        });
        _subscribers[id] = channel;
        return (id, channel.Reader);
    }

    public void Unsubscribe(Guid id)
    {
        if (_subscribers.TryRemove(id, out var channel)) channel.Writer.TryComplete();
    }

    public void Publish()
    {
        foreach (var channel in _subscribers.Values) channel.Writer.TryWrite(true);
    }
}

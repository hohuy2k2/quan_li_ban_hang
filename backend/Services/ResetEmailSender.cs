using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace InventoryApp;

/** Gửi mã khôi phục qua SMTP; đọc tài khoản Gmail từ mailsettings.local.json. */
public sealed class ResetEmailSender(IConfiguration configuration)
{
    private readonly string? host = configuration["Mail:Host"]?.Trim();
    private readonly string? user = configuration["Mail:User"]?.Trim();
    private readonly string? password = configuration["Mail:Password"]?.Replace(" ", "").Trim();
    private readonly string? fromAddress = string.IsNullOrWhiteSpace(configuration["Mail:FromAddress"])
        ? configuration["Mail:User"] : configuration["Mail:FromAddress"];
    private readonly string fromName = configuration["Mail:FromName"] ?? "Cửa hàng";
    private readonly int port = int.TryParse(configuration["Mail:Port"], out var configuredPort) ? configuredPort : 587;

    public string? ConfigurationError
    {
        get
        {
            if (string.IsNullOrWhiteSpace(host) || string.IsNullOrWhiteSpace(user) ||
                string.IsNullOrWhiteSpace(password) || string.IsNullOrWhiteSpace(fromAddress) ||
                port is < 1 or > 65535)
                return "Cửa hàng chưa cấu hình đầy đủ email gửi mã khôi phục.";
            // if (host.Equals("smtp.gmail.com", StringComparison.OrdinalIgnoreCase) && password.Length != 16)
            //     return "Mật khẩu ứng dụng Gmail cần đủ 16 ký tự. Hãy kiểm tra lại mục Password trong mailsettings.local.json.";
            return null;
        }
    }

    public bool IsConfigured => ConfigurationError is null;

    public async Task SendResetCode(string recipient, string code, CancellationToken cancellationToken)
    {
        if (!IsConfigured) throw new InvalidOperationException("SMTP chưa được cấu hình.");

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(fromName, fromAddress!));
        message.To.Add(MailboxAddress.Parse(recipient));
        message.Subject = "Mã đặt lại mật khẩu";
        message.Body = new TextPart("plain")
        {
            Text = $"Mã đặt lại mật khẩu của bạn là: {code}\n\nMã có hiệu lực trong 10 phút. Nếu bạn không yêu cầu, hãy bỏ qua email này."
        };

        using var client = new SmtpClient { Timeout = 15000 };
        await client.ConnectAsync(host!, port, SecureSocketOptions.StartTls, cancellationToken);
        await client.AuthenticateAsync(user!, password!, cancellationToken);
        await client.SendAsync(message, cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);
    }
}

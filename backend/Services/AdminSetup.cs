using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;

namespace InventoryApp;

public static class AdminSetup
{
    /** Tạo hoặc đổi mật khẩu admin từ cửa sổ lệnh trên chính máy chủ. */
    public static async Task Run(InventoryDb db, IPasswordHasher<AppUser> hasher)
    {
        Console.Write("Email quản trị: ");
        var email = Console.ReadLine()?.Trim() ?? "";
        if (!System.Net.Mail.MailAddress.TryCreate(email, out var address) ||
            !address.Address.Equals(email, StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("Email không hợp lệ.");
        Console.Write("Mật khẩu mới (ít nhất 8 ký tự): ");
        var password = ReadPassword();
        Console.Write("Nhập lại mật khẩu: ");
        var confirmation = ReadPassword();
        if (password.Length < 8 || password.Length > 128 || password != confirmation)
            throw new InvalidOperationException("Mật khẩu không khớp hoặc không đủ 8 ký tự.");

        var normalized = email.ToUpperInvariant();
        var user = await db.AppUsers.FirstOrDefaultAsync(u => u.NormalizedEmail == normalized);
        if (user is null)
        {
            user = new AppUser { Email = email, NormalizedEmail = normalized,
                DisplayName = "Quản trị viên", CreatedAt = DateTime.UtcNow };
            db.AppUsers.Add(user);
        }
        user.Role = "admin";
        user.IsActive = true;
        user.SecurityStamp = Guid.NewGuid().ToString("N");
        user.PasswordHash = hasher.HashPassword(user, password);
        await db.SaveChangesAsync();
        Console.WriteLine("Đã lưu tài khoản admin. Các phiên đăng nhập cũ của tài khoản này đã hết hiệu lực.");
    }

    private static string ReadPassword()
    {
        if (Console.IsInputRedirected) return Console.ReadLine() ?? "";
        var text = new System.Text.StringBuilder();
        while (true)
        {
            var key = Console.ReadKey(intercept: true);
            if (key.Key == ConsoleKey.Enter) { Console.WriteLine(); return text.ToString(); }
            if (key.Key == ConsoleKey.Backspace)
            {
                if (text.Length > 0) text.Length--;
            }
            else if (!char.IsControl(key.KeyChar)) text.Append(key.KeyChar);
        }
    }
}

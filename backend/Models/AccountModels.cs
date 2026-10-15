namespace InventoryApp;

// Một bảng tài khoản dùng cho quản trị viên và khách, phân quyền bằng Role.
public sealed class AppUser
{
    public int Id { get; set; }
    public string Email { get; set; } = "";
    public string NormalizedEmail { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string Phone { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string SecurityStamp { get; set; } = "";
    public string Role { get; set; } = "customer";
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; }
    public string ResetCodeProtected { get; set; } = "";
    public DateTime? ResetCodeExpiresAt { get; set; }
    public DateTime? ResetCodeRequestedAt { get; set; }
    public int ResetCodeAttempts { get; set; }
}

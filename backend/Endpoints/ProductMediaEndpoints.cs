using System.Text.RegularExpressions;

namespace InventoryApp;

public static partial class ProductMediaEndpoints
{
    private const long MaxImageBytes = 3 * 1024 * 1024;

    public static void MapProductMediaEndpoints(this WebApplication app, string dataDirectory)
    {
        var imageDirectory = Path.Combine(dataDirectory, "product-images");
        Directory.CreateDirectory(imageDirectory);

        // Ảnh phục vụ khách là công khai; tên tệp ngẫu nhiên không nhận đường dẫn từ người dùng.
        app.MapGet("/api/store/images/{fileName}", (string fileName) =>
        {
            if (!ImageName().IsMatch(fileName)) return Results.NotFound();
            var path = Path.Combine(imageDirectory, fileName);
            if (!File.Exists(path)) return Results.NotFound();
            var contentType = Path.GetExtension(fileName) switch
            {
                ".jpg" => "image/jpeg", ".png" => "image/png", _ => "image/webp"
            };
            return Results.File(path, contentType, enableRangeProcessing: true);
        });

        app.MapPost("/api/product-images", async (HttpRequest request) =>
        {
            if (!request.HasFormContentType)
                return Results.BadRequest(new { message = "Hãy chọn một tệp ảnh." });
            IFormCollection form;
            try { form = await request.ReadFormAsync(); }
            catch (InvalidDataException)
            {
                return Results.BadRequest(new { message = "Tệp tải lên không hợp lệ." });
            }
            catch (IOException)
            {
                return Results.BadRequest(new { message = "Tệp tải lên không đầy đủ." });
            }
            var file = form.Files.GetFile("image");
            if (file is null || file.Length is < 1 or > MaxImageBytes)
                return Results.BadRequest(new { message = "Ảnh phải có dung lượng tối đa 3 MB." });

            await using var memory = new MemoryStream();
            await file.CopyToAsync(memory);
            var bytes = memory.ToArray();
            var extension = DetectExtension(bytes);
            if (extension is null)
                return Results.BadRequest(new { message = "Chỉ nhận ảnh JPEG, PNG hoặc WebP hợp lệ." });
            var fileName = $"{Guid.NewGuid():N}{extension}";
            await File.WriteAllBytesAsync(Path.Combine(imageDirectory, fileName), bytes);
            return Results.Ok(new { imageUrl = $"/api/store/images/{fileName}" });
        });
    }

    private static string? DetectExtension(byte[] bytes)
    {
        if (bytes.Length >= 3 && bytes[0] == 0xff && bytes[1] == 0xd8 && bytes[2] == 0xff)
            return ".jpg";
        if (bytes.Length >= 8 && bytes.AsSpan(0, 8).SequenceEqual(new byte[] { 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a }))
            return ".png";
        if (bytes.Length >= 12 && bytes.AsSpan(0, 4).SequenceEqual("RIFF"u8) && bytes.AsSpan(8, 4).SequenceEqual("WEBP"u8))
            return ".webp";
        return null;
    }

    [GeneratedRegex("^[a-f0-9]{32}\\.(jpg|png|webp)$", RegexOptions.IgnoreCase)]
    private static partial Regex ImageName();
}

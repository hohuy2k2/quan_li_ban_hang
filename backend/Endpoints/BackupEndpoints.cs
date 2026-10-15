using System.IO.Compression;
using Microsoft.Data.Sqlite;

namespace InventoryApp;

public static class BackupEndpoints
{
    public static void MapBackupEndpoints(this WebApplication app, string dataDirectory, string databasePath)
    {
        app.MapGet("/api/backup", async () =>
        {
            var temporaryFile = Path.Combine(dataDirectory, $".backup-{Guid.NewGuid():N}.db");
            try
            {
                await using (var source = new SqliteConnection($"Data Source={databasePath};Pooling=False"))
                await using (var destination = new SqliteConnection($"Data Source={temporaryFile};Pooling=False"))
                {
                    await source.OpenAsync();
                    await destination.OpenAsync();
                    source.BackupDatabase(destination);
                }
                var bytes = await File.ReadAllBytesAsync(temporaryFile);
                return Results.File(bytes, "application/octet-stream", $"quan-ly-ban-hang-{DateTime.Now:yyyyMMdd-HHmm}.db");
            }
            finally
            {
                if (File.Exists(temporaryFile)) File.Delete(temporaryFile);
            }
        });

        // Bản ZIP giữ cả SQLite và ảnh sản phẩm để có thể khôi phục website sau sự cố máy.
        app.MapGet("/api/backup/full", async () =>
        {
            var temporaryDb = Path.Combine(dataDirectory, $".backup-{Guid.NewGuid():N}.db");
            var temporaryZip = Path.Combine(dataDirectory, $".backup-{Guid.NewGuid():N}.zip");
            try
            {
                await using (var source = new SqliteConnection($"Data Source={databasePath};Pooling=False"))
                await using (var destination = new SqliteConnection($"Data Source={temporaryDb};Pooling=False"))
                {
                    await source.OpenAsync();
                    await destination.OpenAsync();
                    source.BackupDatabase(destination);
                }
                await using (var output = File.Create(temporaryZip))
                using (var archive = new ZipArchive(output, ZipArchiveMode.Create))
                {
                    archive.CreateEntryFromFile(temporaryDb, "inventory.db", CompressionLevel.Optimal);
                    var imageDirectory = Path.Combine(dataDirectory, "product-images");
                    if (Directory.Exists(imageDirectory))
                        foreach (var image in Directory.EnumerateFiles(imageDirectory))
                            archive.CreateEntryFromFile(image, $"product-images/{Path.GetFileName(image)}", CompressionLevel.Optimal);
                }
                return Results.File(await File.ReadAllBytesAsync(temporaryZip), "application/zip",
                    $"quan-ly-ban-hang-{DateTime.Now:yyyyMMdd-HHmm}.zip");
            }
            finally
            {
                if (File.Exists(temporaryDb)) File.Delete(temporaryDb);
                if (File.Exists(temporaryZip)) File.Delete(temporaryZip);
            }
        });
    }
}

using GetTrainMate.Api.Services.PartnerOutreach;
using Microsoft.Extensions.Logging.Abstractions;

var targetsPath = args.Length > 0 ? args[0] : Path.Combine(Path.GetTempPath(), "dryrun-targets.json");
if (!File.Exists(targetsPath))
{
    Console.Error.WriteLine($"Missing targets file: {targetsPath}");
    return 1;
}

var json = await File.ReadAllTextAsync(targetsPath);
using var doc = System.Text.Json.JsonDocument.Parse(json);
var targets = new List<(string Id, string Name, string Website)>();
foreach (var el in doc.RootElement.EnumerateArray())
{
    targets.Add((
        el.GetProperty("Id").GetString() ?? "",
        el.GetProperty("Name").GetString() ?? "",
        el.GetProperty("Website").GetString() ?? ""
    ));
}

using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(25) };
var verifier = new PublicBusinessContactVerifier(http, NullLogger<PublicBusinessContactVerifier>.Instance);

Console.WriteLine("CONTACT DISCOVERY DRY-RUN (no saves)");
Console.WriteLine($"Targets: {targets.Count}");
Console.WriteLine(new string('-', 100));

var rows = new List<string>();
rows.Add("| # | Organization | Website | Result | Email / Form | Confidence | Source URL | Detail |");
rows.Add("|---|---|---|---|---|---|---|---|");

var i = 0;
foreach (var t in targets.Take(12))
{
    i++;
    if (!Uri.TryCreate(t.Website, UriKind.Absolute, out var uri))
    {
        rows.Add($"| {i} | {Escape(t.Name)} | {Escape(t.Website)} | invalid_url | — | — | — | bad website |");
        Console.WriteLine($"[{i}] {t.Name}: invalid URL");
        continue;
    }

    Console.WriteLine($"[{i}/{Math.Min(12, targets.Count)}] Probing {t.Name} …");
    WebsiteProbeResult probe;
    try
    {
        probe = await verifier.ProbeAsync(uri, maxContactPaths: 12);
    }
    catch (Exception ex)
    {
        rows.Add($"| {i} | {Escape(t.Name)} | {Escape(Short(t.Website))} | error | — | — | — | {Escape(ex.Message)} |");
        Console.WriteLine($"  ERROR: {ex.Message}");
        continue;
    }

    var email = probe.Contact?.Email ?? "—";
    var form = probe.ContactFormUrl ?? "—";
    var found = probe.Contact?.Email ?? (probe.ContactFormUrl != null ? $"FORM: {Short(probe.ContactFormUrl)}" : "—");
    var conf = probe.Contact?.Confidence.ToString() ?? probe.Confidence.ToString();
    var src = probe.Contact?.SourceUrl ?? probe.SampleUrl ?? "—";
    var result = probe.Status.ToString();
    var detail = probe.Detail ?? probe.SourcesCheckedSummary ?? probe.ReasonCode ?? "";
    rows.Add($"| {i} | {Escape(t.Name)} | {Escape(Short(t.Website))} | {result} | {Escape(Short(found, 40))} | {conf} | {Escape(Short(src))} | {Escape(Short(detail, 80))} |");
    Console.WriteLine($"  → {result} | {found} | {conf} | pages={probe.PagesChecked?.Count ?? 0}");
}

var outPath = Path.Combine(Path.GetTempPath(), "contact-dryrun-results.md");
await File.WriteAllLinesAsync(outPath, rows);
Console.WriteLine(new string('-', 100));
Console.WriteLine($"Wrote {outPath}");
foreach (var line in rows) Console.WriteLine(line);
return 0;

static string Escape(string s) => (s ?? "").Replace("|", "/").Replace("\n", " ").Replace("\r", "");
static string Short(string s, int n = 60)
{
    s ??= "";
    return s.Length <= n ? s : s[..(n - 1)] + "…";
}

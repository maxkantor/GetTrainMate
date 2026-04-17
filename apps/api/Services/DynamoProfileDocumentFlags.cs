using Amazon.DynamoDBv2.DocumentModel;

namespace GetTrainMate.Api.Services;

/// <summary>
/// Dynamo may store flags as BOOL, N (1/0), or legacy strings. Plain <c>AsBoolean()</c> misses or skips closed rows.
/// </summary>
internal static class DynamoProfileDocumentFlags
{
    public static bool IsAccountClosed(Document? doc)
    {
        if (doc == null || !doc.ContainsKey("accountClosed")) return false;
        var v = doc["accountClosed"];
        if (v == null) return false;
        if (v is DynamoDBBool b) return b.Value;
        if (v is Primitive p)
        {
            if (p.Type == DynamoDBEntryType.Numeric) return p.AsInt() != 0;
            if (p.Type == DynamoDBEntryType.String)
                return string.Equals(p.AsString(), "true", StringComparison.OrdinalIgnoreCase);
        }

        try
        {
            return v.AsBoolean();
        }
        catch
        {
            return false;
        }
    }
}

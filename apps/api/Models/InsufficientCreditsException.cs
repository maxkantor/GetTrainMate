namespace GetTrainMate.Api.Models;

/// <summary>Thrown when user has insufficient credits for an action.</summary>
public class InsufficientCreditsException : InvalidOperationException
{
    public const string ErrorCode = "INSUFFICIENT_CREDITS";

    public InsufficientCreditsException(string message) : base(message) { }
}

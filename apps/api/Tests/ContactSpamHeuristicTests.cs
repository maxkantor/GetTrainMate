using GetTrainMate.Api.Controllers;
using GetTrainMate.Api.Models;
using Xunit;

namespace GetTrainMate.Api.Tests;

public class ContactSpamHeuristicTests
{
    [Theory]
    [InlineData("HajdwbeasMorOGSDb", "u.kep.ow.u.r4.57@gmail.com", true)]
    [InlineData("WnpiBlOXEeArBxbhlk", "a.d.od.o.ye.q.o.d.a.k.20@gmail.com", true)]
    [InlineData("Maxim Kantor", "maximkantor@gmail.com", false)]
    [InlineData("MaxK", "mykantor@bellsouth.net", false)]
    public void IsLikelySpamContact_flags_dot_stuffed_and_gibberish(string name, string email, bool expected)
    {
        var c = new Contact { Name = name, Email = email };
        Assert.Equal(expected, AdminContactsController.IsLikelySpamContact(c));
    }
}

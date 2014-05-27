use strict;
use LWP::UserAgent;
use JSON;
use Data::Dumper;
use URI::Escape;

my $readabilityAPIKey = 'd0e009a679aa2ef6b0830ff63b5a2a0660c55d2c';
my $ua = LWP::UserAgent->new(
   ssl_opts => { verify_hostname => 0 },
);
sub getReadability {
    my ($url) = @_;
    my $readabilityURL = sprintf
        "https://www.readability.com/api/content/v1/parser?url=%s&token=%s",
        uri_escape($url),
        $readabilityAPIKey;

    my $req = HTTP::Request->new(GET => $readabilityURL);
    my $res = $ua->request($req);

    # Check the outcome of the response
    if (! $res->is_success) {
        print $readabilityURL, "\n";
        die sprintf  "*Error* from GET: %s", $res->status_line;
    }
    # print $res->content;
    return decode_json($res->content);
}
my $url = 'https://web.gratisdns.dk/?q=node/183';

my $readability = getReadability($url);
my $d = Data::Dumper->new([$readability]);
$d->Sortkeys(1);
$d->Indent(1);
print $d->Dump();
# __END__


#!/usr/bin/perl -w
use strict;

use Encode;
use LWP::UserAgent;
use XML::RSS;
use JSON;
use Data::Dumper;
use DateTime::Format::Mail;
use URI::Escape;
use HTML::Entities;
use FindBin;
use IPC::Run qw(run);

use utf8;

# See https://hn.algolia.com/api
my $jsonURL = 'https://hn.algolia.com/api/v1/search_by_date?tags=%28story,poll%29&numericFilters=points%3E100';

my $db = 'descriptions.db';

# my $db = 'foo.db';

my $ua = LWP::UserAgent->new(
   # ssl_opts => { verify_hostname => 0 },
);
$ua->agent("Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:61.0) Gecko/20100101 Firefox/61.0");

sub getFirehoseJSON {

    # Create a request
    my $req = HTTP::Request->new(GET => $jsonURL);

    # Pass request to the user agent and get a response back
    my $res = $ua->request($req);

    # Check the outcome of the response
    if (! $res->is_success) {
        die sprintf  "*Error* from GET: %s", $res->status_line;
    }
    return $res->content;
}

my $json = getFirehoseJSON();

# my $json;
# open(my $i, "ost2.json");
# {
#     local $/;
#     $json = <$i>;
# }
# close $i;

# print $res->content;
my $firehose = decode_json($json);

# my $d = Data::Dumper->new([$firehose]);
# $d->Sortkeys(1);
# $d->Indent(1);
# print $d->Dump();
# __END__

# my $rss = new XML::RSS (version => '1.0', encoding=>'ISO-8859-1');
my $rss = new XML::RSS (version => '1.0');
$rss->channel(
  title        => "Hacker News 100 - Readable Contents",
  description  => "by Peter Valdemar Mørch",
);
use DBI;
my $dbh = DBI->connect("dbi:SQLite2:dbname=$db","","");

my $getDescrSth = $dbh->prepare('
    SELECT description
      FROM descriptions
     WHERE objectID = ?
');

my $insertDescrSth = $dbh->prepare('
    INSERT INTO descriptions
        (objectID, description, createTime)
    VALUES (?,?,?)
');

sub getReadable {
    my ($url) = @_;
    printf STDERR "Getting %s\n", $url;
    my $exec = "$FindBin::Bin/python/bin/breadability";
    my $stdout;
    my $stderr;
    my $success = run(
        [ $exec, $url ],
        '>', \$stdout,
        '2>', \$stderr
    );
    my $readable;
    if ($success) {
        $readable = $stdout;
    } else {

        $readable = qq{Couldn't get $url with breadability.};
        if ($stdout) {
            $readable .= qq{ STDOUT: $stdout};
        }
        if ($stderr) {
            $readable .= qq{ STDERR: $stderr};
        }
    }
    return $readable;
}

sub getDescription {
    my ($hit) = @_;

    my $readable = getReadable(
        $hit->{url} ?  $hit->{url} : $hit->{hnewsUrl}
    );

    my $encURL = encode_entities($hit->{url});
    my $encHnewsURL = encode_entities($hit->{hnewsUrl});

    my $description = '<p>';
    if ($hit->{url}) {
        $description .= sprintf 'URL: <a href="%s">%s</a>, ', $encURL, $encURL;
    }
    $description .= sprintf qq(See on <a href="%s">Hacker News</a></p>\n%s\n),
        $encHnewsURL,
        $readable;
    return $description;
}

# binmode(STDOUT, ":utf8");
foreach my $hit (@{ $firehose->{hits} }) {
    my $hnewsUrl = sprintf "https://news.ycombinator.com/item?id=%d",
        $hit->{objectID};
    $hit->{hnewsUrl} = $hnewsUrl;

    $getDescrSth->execute($hit->{objectID});

    my ($description) = $getDescrSth->fetchrow_array();
    unless ($description) {
        $description = getDescription($hit);
        $insertDescrSth->execute($hit->{objectID}, $description, time);
    }
    my $descriptionChars = Encode::decode('UTF-8', $description);
    # $descriptionChars = 'æøå don’t in UTF8<br>' . $descriptionChars;
    my $dt = DateTime->from_epoch( epoch => $hit->{created_at_i} );
    my $dateStr = DateTime::Format::Mail->format_datetime( $dt );
    my %item = (
        title       => sprintf("%s%s (%d pts)",
                            $hit->{url} ? '' : 'HNInternal: ',
                            $hit->{title}, $hit->{points}),
        link        => $hit->{url} // $hnewsUrl,
        description => $descriptionChars,
        dc => {
            date => $dateStr
        }
    );
    # use Data::Dump qw(dump);
    # print dump(\%item), "\n";
    $rss->add_item(%item);
}

print $rss->as_string();

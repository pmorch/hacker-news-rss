#!/usr/bin/perl -w
use strict;

use LWP::UserAgent;
use XML::RSS;
use JSON;
use Data::Dumper;
use DateTime::Format::Mail;
use URI::Escape;
use utf8;

=head1 

    base@peter:~/work/hackerNewsRSS> sqlite3 descriptions.db
    SQLite version 3.7.9 2011-11-01 00:52:41
    Enter ".help" for instructions
    Enter SQL statements terminated with a ";"
    sqlite> SELECT * from descriptions;
    sqlite> .schema descriptions
    CREATE TABLE descriptions(objectID integer primary key, description text, createTime integer);

=cut

# See https://hn.algolia.com/api
my $jsonURL = 'https://hn.algolia.com/api/v1/search_by_date?tags=%28story,poll%29&numericFilters=points%3E100';
my $readabilityAPIKey = 'd0e009a679aa2ef6b0830ff63b5a2a0660c55d2c';

my $ua = LWP::UserAgent->new(
   # ssl_opts => { verify_hostname => 0 },
);
# $ua->agent("MyApp/0.1 ");

# Create a request
my $req = HTTP::Request->new(GET => $jsonURL);

# Pass request to the user agent and get a response back
my $res = $ua->request($req);

# Check the outcome of the response
if (! $res->is_success) {
    die sprintf  "*Error* from GET: %s", $res->status_line;
}
# print $res->content;
my $firehose = decode_json($res->content);

# my $d = Data::Dumper->new([$firehose]);
# $d->Sortkeys(1);
# $d->Indent(1);
# print $d->Dump();
# __END__

# my $rss = new XML::RSS (version => '1.0', encoding=>'ISO-8859-1');
my $rss = new XML::RSS (version => '1.0');
$rss->channel(
  title        => "Hacker News 100 - Readability Contents",
  description  => "by Peter Valdemar Mørch",
);
use DBI;
my $dbh = DBI->connect("dbi:SQLite2:dbname=descriptions.db","","");

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

sub getReadability {
    my ($url) = @_;
    printf STDERR "Getting readability for $url\n";
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

sub getDescription {
    my ($hit) = @_;
    my $readability = getReadability($hit->{url});
    return $readability->{content};
}

# binmode(STDOUT, ":utf8");
foreach my $hit (@{ $firehose->{hits} }) {
    $getDescrSth->execute($hit->{objectID});

    my ($description) = $getDescrSth->fetchrow_array();
    unless ($description) {
        $description = getDescription($hit);
        $insertDescrSth->execute($hit->{objectID}, $description, time);
    }
    my $dt = DateTime->from_epoch( epoch => $hit->{created_at_i} );
    my $dateStr = DateTime::Format::Mail->format_datetime( $dt );
    $rss->add_item(
        title       => sprintf("%s (%d pts)", $hit->{title}, $hit->{points}),
        link        => $hit->{url},
        description => $description,
        dc => {
            date => $dateStr
        }
    );
    # printf "T: %s\nURL: %s\nPoints: %d\nDescription: %s\n\n",
    #     $hit->{title},
    #     $hit->{url},
    #     $hit->{points},
    #     $description;
}

print $rss->as_string();

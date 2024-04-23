# Introduction

This takes an existing [source RSS
feed](https://hn.algolia.com/api/v1/search_by_date?tags=%28story,poll%29&numericFilters=points%3E100)
for Hacker News and runs readability on each item, creating a new RSS feed with
the contents of the item directly embedded in the RSS feed.

The (only?) use of this RSS feed is with Feedly, since I use it :-)

I've seen that some items show up and then disappear from the source feed.
Also, I put the number of Hacker News points in the title. Sometimes, the
source feed mentions a post later with higher points. That means another title,
and Feedly treats that as a new post entry. That leeds to duplicates in the
feed as viewed in Feedly.

To work around the first issue: We first read the source feed. For each item
we check if it is in the database already, and if it isn't call readability for
this article, and put the final result in the database. Afterwards, we `SELECT`
all articles from the last 24 hours and create a feed with them. This has the
advantage that if a feed disappears in the source, it won't in this output.
Duplicates are avoided.

To avoid duplicates when "points" are updated, I've tried using a good ID for
each article.

# Run on NAS, lip.morch.com or base?

The thing is that this uses quite a lot of RAM. On lip.morch.com with 4GB of RAM, this would sometimes OOM. So we run it on base.

# Dependencies

You'll need these two files, that aren't saved in the git repo (or create new
ones in github):

* 'data/hn100-sshkey'
* 'data/hn100-sshkey.pub'

And
```shell
mkdir -p data
git clone git@github.com:pmorch/hacker-news-rss.git data/github-output
```

Build docker image:

```shell
sudo docker build -t hacker-news-rss .
```

...or to run it without docker:

```shell
# nix-shell uses shell.nix that installs nodejs and sqlite
nix-shell
npm install
```

# To tidy up DB later

```
sqlite3 data/articles.db 'SELECT COUNT(1) from articles;'
sqlite3 data/articles.db 'DELETE FROM articles; VACUUM;'
```

or simply

```
rm data/articles.db
```

# Run

```shell
sudo docker run --rm --name hacker-news-rss -v $PWD/data:/hacker/data hacker-news-rss
```
...or to run it without docker:

```shell
./runRss.sh
```

# Make sure this runs periodically

```shell
sudo cp hackerNewsCronD /etc/cron.d
sudo chown root: /etc/cron.d/hackerNewsCronD
```

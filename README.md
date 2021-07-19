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

To work around these two issues: We first read the source feed. For each item
we check if it is in the database already, and if it isn't call readability for
this article, and put the final result in the database. Afterwards, we `SELECT`
all articles from the last 24 hours and create a feed with them. This has the
advantage that if a feed disappears in the source, it won't in this output.
Duplicates are avoided. However, the "points" aren't updated.

# Dependencies

    sudo apt install docker.io docker-compose npm
    npm install

# To tidy up DB later

    sqlite3 descriptions.db 'SELECT COUNT(*) FROM descriptions;'
    sqlite3 descriptions.db 'DELETE FROM descriptions; VACUUM;'

# Run
    ./runRss.sh

# Docker nginx to serve the output

    docker-compose up -d

# Make sure this runs periodically

    sudo cp hackerNewsCronD /etc/cron.d
    sudo chown root: /etc/cron.d/hackerNewsCronD

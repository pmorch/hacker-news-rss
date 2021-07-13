# Dependencies

    sudo apt install docker.io docker-compose sqlite libwww-perl libxml-rss-perl libjson-perl libipc-run-perl libdbd-sqlite2-perl virtualenv

# Create database

    sqlite description.db 'CREATE TABLE descriptions(objectID integer primary key, description text, createTime integer);'

To tidy up later:

    sqlite descriptions.db 'SELECT COUNT(*) FROM descriptions;'

    sqlite descriptions.db 'DELETE FROM descriptions;'
    sqlite descriptions.db 'VACUUM;'

# Setup virtualenv

    mkdir python
    cd python
    virtualenv .
    ./bin/pip install breadability

# Run
    ./runRss.sh

# Docker nginx to serve the output

    docker-compose up -d

# Make sure this runs periodically

    sudo cp hackerNewsCronD /etc/cron.d
    sudo chmod root: /etc/cron.d/hackerNewsCronD

FROM node:latest

# Sorry, but there already is a node:node group:user with ids 1000:1000
# And this happens to be the group:user that I use...
ENV userID=1248
ENV groupID=1248
RUN groupadd -g $groupID user && useradd -g $groupID -u $userID -m -s /bin/bash user

# This knows about git@github.com:pmorch/HackerNews100.git so we can push to it...
COPY known_hosts /home/user/.ssh/known_hosts
RUN chown -R user:user /home/user/.ssh

RUN mkdir /hacker
WORKDIR /hacker
COPY package.json package-lock.json ./
RUN npm install
COPY rss.js runRss.sh ./
ENTRYPOINT ./runRss.sh

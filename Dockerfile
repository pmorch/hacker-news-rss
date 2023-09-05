FROM ubuntu:latest

RUN apt-get update && apt-get install -y --no-install-recommends \
  git \
  openssh-client \
  nodejs \
  npm \
  && rm -rf /var/lib/apt/lists/*

# This happens to be the group:user that I use...
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
USER $userID:$groupID
ENTRYPOINT ./runRss.sh

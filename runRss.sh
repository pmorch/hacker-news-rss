#! /usr/bin/env bash
set -e
dbFile=$1; shift
ghOutDir=$1; shift

if [ "$ghOutDir" = "" -o ! -d $ghOutDir/.git ] ; then
  echo '*Error*: <dbFile> <githubOutDir>'
fi

outfile=$ghOutDir/hn100.xml
echo '*******************************'
date +'%Y-%M-%d %T %Z'
node ./rss.js $dbFile > $outfile

gitCommitPush() {
    commitExitCode=0
    git -C $ghOutDir commit -m "Update" hn100.xml || commitExitCode=$?
    if [ $commitExitCode = 0 ] ; then
        GIT_SSH_COMMAND='ssh -i ../hn100-sshkey' git  -C $ghOutDir push origin main
    fi
}

gitCommitPush

date +'%Y-%M-%d %T %Z'
echo '-------------------------------'

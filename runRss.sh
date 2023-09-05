#!/bin/bash
set -e
cd $(dirname $0)
logfile=data/run.log

ghOutDir=data/github-output
outfile=$ghOutDir/hn100.xml
echo '*******************************' >> $logfile
date >> $logfile
node ./rss.js > $outfile 2>>$logfile

gitCommitPush() {
    commitExitCode=0
    git -C $ghOutDir commit -m "Update" hn100.xml || commitExitCode=$?
    if [ $commitExitCode = 0 ] ; then
        GIT_SSH_COMMAND='ssh -i ../hn100-sshkey' git  -C $ghOutDir push origin main
    fi
}

gitCommitPush >> $logfile 2>&1

date >> $logfile
echo '-------------------------------' >> $logfile

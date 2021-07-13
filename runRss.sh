#!/bin/bash
set -e
cd $(dirname $0)
mkdir -p output
logfile=output/run.log
outfile=output/hackerNews100.xml
echo '*******************************' >> $logfile
date >> $logfile
./rss.pl > $outfile 2>>$logfile


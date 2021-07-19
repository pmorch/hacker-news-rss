#!/bin/bash
set -e
cd $(dirname $0)
mkdir -p output
logfile=output/run.log

outfile=output/hackerNews100.xml
echo '*******************************' >> $logfile
date >> $logfile
./rss.js > $outfile 2>>$logfile

outfilePL=output/hackerNews100-pl.xml
echo '-------------------------------' >> $logfile
./rss.pl > $outfilePL 2>>$logfile

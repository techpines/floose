#!/bin/bash

git add -A
git commit -m $(git branch | sed -n -e 's/^\* \(.*\)/\1/p');
git push origin $(git branch | sed -n -e 's/^\* \(.*\)/\1/p');
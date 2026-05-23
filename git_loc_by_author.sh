#!/bin/bash

echo "Author                    Added     Deleted     Total      %"
echo "----------------------------------------------------------------"

git log --since="30 days ago" --numstat --pretty="%an" \
| awk '
  /^[0-9]/ {
      added=$1; deleted=$2;
      totalAdded[author]+=added;
      totalDeleted[author]+=deleted;
  }
  /^[^0-9]/ {
      author=$0;
  }
  END {
      grand=0;
      for (a in totalAdded) {
          grand += (totalAdded[a] + totalDeleted[a]);
      }

      for (a in totalAdded) {
          a_added = totalAdded[a];
          a_deleted = totalDeleted[a];
          a_total = a_added + a_deleted;
          pct = (grand > 0) ? (100.0 * a_total / grand) : 0;

          printf "%-24s %7d   %7d   %7d   %6.2f%%\n", a, a_added, a_deleted, a_total, pct;
      }
  }
' | sort


### Gator 
# an RSS feed aggregator/reader
# written in Go.

## Usage
After any changes:
go build -o gator
then use 
./gator <command> to use the app

## Commands
--- User Management ---
help      | go run . help                    | Displays the help menu & commands
login     | go run . login <name>            | Logs in <name> user
register  | go run . register <name>         | Registers <name> user
users     | go run . users                   | Lists users including (current) signifier
reset     | go run . reset                   | Resets all tables
--- Feed Management ---
addfeed   | go run . addfeed <name> <url>    | Adds <url>(feed) to current signed in user as an RSSfeed named <name>
agg       | go run . agg <time_between_reqs> | Pulls RSSdata from your feeds with a <time_between_reqs> refresher - CTRL + C to stop
follow    | go run . follow <url>            | Follows <url> as current signed in user
unfollow  | go run . unfollow <url>          | Unfollows <url> as current signed in user
feeds     | go run . feeds                   | Lists all feeds and their 'main' user
following | go run . following               | Lists the current users followed URLs/RSSfeeds
browse    | go run . browse <limit (def: 2)> | Lists the newest posts in current users feed

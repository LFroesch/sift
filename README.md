# Gator

An RSS feed aggregator/reader written in Go.

## Usage

After any changes:
```bash
go build -o bin/gator-api cmd/api/main.go
go build -o bin/gator cmd/cli/main.go    
./bin/gator <command>
./bin/gator help # for info
```

## To Reset Your Posts (DANGER)
DELETE FROM posts;

## Commands

### User Management
| Command | Usage | Description |
|---------|-------|-------------|
| `help` | `./gator help` | Displays the help menu & commands |
| `login` | `./gator login <name>` | Logs in user |
| `register` | `./gator register <name>` | Registers new user |
| `users` | `./gator users` | Lists users including (current) signifier |
| `reset` | `./gator reset` | Resets all tables |

### Feed Management
| Command | Usage | Description |
|---------|-------|-------------|
| `addfeed` | `./gator addfeed <name> <url>` | Adds RSS feed with given name and URL |
| `agg` | `./gator agg <time_between_reqs>` | Pulls RSS data from feeds (CTRL + C to stop) |
| `follow` | `./gator follow <url>` | Follows RSS feed URL |
| `unfollow` | `./gator unfollow <url>` | Unfollows RSS feed URL |
| `feeds` | `./gator feeds` | Lists all feeds and their owners |
| `following` | `./gator following` | Lists current user's followed feeds |
| `browse` | `./gator browse <limit>` | Lists newest posts (default limit: 2) |

## Setup

1. Ensure PostgreSQL is running
2. Create database: `createdb gator`
3. Build the application: `go build -o gator`
4. Register a user: `./gator register <username>`
5. Login: `./gator login <username>`
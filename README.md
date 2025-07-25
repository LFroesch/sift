# Gator

A web-based RSS feed aggregator/reader with a React frontend and Go backend API.

## Features

- Modern web interface for managing RSS feeds
- User authentication and management
- Real-time feed aggregation
- Post browsing and filtering
- Responsive design with Tailwind CSS

## Getting Started

### Prerequisites
- PostgreSQL database
- Node.js (for frontend development)
- Go 1.19+ (for backend API)

### Setup

1. **Database Setup**
   ```bash
   createdb gator
   ```

2. **Backend API**
   ```bash
   go build -o bin/gator-api cmd/api/main.go
   ./bin/gator-api
   ```

3. **Frontend Development**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

4. **Production Build**
   ```bash
   cd frontend
   npm run build
   ```

## Architecture

- **Frontend**: React with Vite, Tailwind CSS, React Router
- **Backend**: Go REST API with PostgreSQL
- **Database**: PostgreSQL for feed and user data

---

*Note: This project originally included a CLI interface. For CLI usage, see the legacy commands section below.*

<details>
<summary>Legacy CLI Commands</summary>

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

### CLI Setup
```bash
go build -o bin/gator cmd/cli/main.go    
./bin/gator <command>
./bin/gator help # for info
```

</details>
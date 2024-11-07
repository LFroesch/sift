package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	"github.com/LFroesch/Gator/internal/config"
	"github.com/LFroesch/Gator/internal/database"
	_ "github.com/lib/pq"
)

type state struct {
	db  *database.Queries
	cfg *config.Config
}

func main() {
	// Read the configuration
	cfg, err := config.Read()
	if err != nil {
		log.Fatalf("Failed to read config: %v", err)
	}
	// set the dbURL (I do have this in config, maybe theres a way to get it?)
	dbURL := "postgres://postgres:123123@localhost:5432/gator?sslmode=disable"
	// establish connection between program and PostgreSQL + error check
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("Failed to open db: %v", err)
	}
	// this creates an object that wraps all the sql queries in sql/queries
	// basically a translator that converts our go code into SQL commands
	dbQueries := database.New(db)

	// Create the state struct, assigning the config and dbqueries
	programState := &state{
		db:  dbQueries,
		cfg: &cfg,
	}

	// Initialize the Commands struct with an empty map
	cmds := commands{
		registeredCommands: make(map[string]func(*state, command) error),
	}

	// Register the loginhandler
	cmds.register("login", handlerLogin)
	cmds.register("register", handlerRegister)
	cmds.register("reset", handlerReset)
	cmds.register("users", handlerGetUsers)
	cmds.register("agg", handlerAgg)
	cmds.register("addfeed", middlewareLoggedIn(handlerAddFeed))
	cmds.register("feeds", handlerPrintAllFeeds)
	cmds.register("follow", middlewareLoggedIn(handlerFollow))
	cmds.register("following", middlewareLoggedIn(handlerFollowing))
	cmds.register("unfollow", middlewareLoggedIn(handlerUnfollow))
	cmds.register("browse", middlewareLoggedIn(handlerBrowse))
	cmds.register("help", handlerHelp)

	// Step 5: Parse command line arguments
	if len(os.Args) < 2 {
		fmt.Println("Usage: cli <command> [args...]")
		os.Exit(1)
	}

	// Step 6: Extract command name and arguments
	cmdName := os.Args[1]
	cmdArgs := os.Args[2:]

	// Step 7: Run the command
	err = cmds.run(programState, command{Name: cmdName, Args: cmdArgs})
	if err != nil {
		log.Fatal(err)
	}
}

package main

import (
	"database/sql"
	"fmt"
	"log"
	"os"

	"github.com/LFroesch/Gator/handlers"
	"github.com/LFroesch/Gator/internal/config"
	"github.com/LFroesch/Gator/internal/database"
	_ "github.com/lib/pq"
)

func main() {
	// Read the configuration
	cfg, err := config.Read()
	if err != nil {
		log.Fatalf("Failed to read config: %v", err)
	}
	// set the dbURL (I do have this in config, maybe theres a way to get it?)
	dbURL := "postgres://postgres:postgres@localhost:5432/gator?sslmode=disable"
	// establish connection between program and PostgreSQL + error check
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("Failed to open db: %v", err)
	}
	// this creates an object that wraps all the sql queries in sql/queries
	// basically a translator that converts our go code into SQL commands
	dbQueries := database.New(db)

	// Create the state struct, assigning the config and dbqueries
	programState := &handlers.State{
		Db:  dbQueries,
		Cfg: &cfg,
	}

	// Initialize the Commands struct with an empty map
	cmds := handlers.Commands{
		RegisteredCommands: make(map[string]func(*handlers.State, handlers.Command) error),
	}

	// Register the handlers (you'll need to move these from main.go to here or import them)
	cmds.Register("login", handlers.HandlerLogin)
	cmds.Register("register", handlers.HandlerRegister)
	cmds.Register("reset", handlers.HandlerReset)
	cmds.Register("users", handlers.HandlerGetUsers)
	cmds.Register("agg", handlers.HandlerAgg)
	cmds.Register("addfeed", handlers.MiddlewareLoggedIn(handlers.HandlerAddFeed))
	cmds.Register("feeds", handlers.HandlerPrintAllFeeds)
	cmds.Register("follow", handlers.MiddlewareLoggedIn(handlers.HandlerFollow))
	cmds.Register("following", handlers.MiddlewareLoggedIn(handlers.HandlerFollowing))
	cmds.Register("unfollow", handlers.MiddlewareLoggedIn(handlers.HandlerUnfollow))
	cmds.Register("browse", handlers.MiddlewareLoggedIn(handlers.HandlerBrowse))
	cmds.Register("help", handlers.HandlerHelp)

	// Step 5: Parse command line arguments
	if len(os.Args) < 2 {
		fmt.Println("Usage: cli <command> [args...]")
		os.Exit(1)
	}

	// Step 6: Extract command name and arguments
	cmdName := os.Args[1]
	cmdArgs := os.Args[2:]

	// Step 7: Run the command
	err = cmds.Run(programState, handlers.Command{Name: cmdName, Args: cmdArgs})
	if err != nil {
		log.Fatal(err)
	}
}

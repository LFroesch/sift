package handlers

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/LFroesch/Gator/internal/config"
	"github.com/LFroesch/Gator/internal/database"
	"github.com/google/uuid"
)

func HandlerLogin(s *State, cmd Command) error {
	if len(cmd.Args) != 1 {
		return fmt.Errorf("usage: %s <name>", cmd.Name)
	}
	name := cmd.Args[0]
	// Check if user exists
	_, err := s.Db.GetUser(context.Background(), name)
	if err != nil {
		if err == sql.ErrNoRows {
			fmt.Fprintf(os.Stderr, "User %s does not exist\n", name)
			os.Exit(1)
		}
		return fmt.Errorf("failed to get user: %w", err)
	}
	err = s.Cfg.SetUser(name)
	if err != nil {
		return fmt.Errorf("couldn't set current user: %w", err)
	}

	fmt.Println("User switched successfully!")
	return nil
}

func HandlerRegister(s *State, cmd Command) error {
	if len(cmd.Args) != 1 {
		return fmt.Errorf("usage: %s <name>", cmd.Name)
	}
	name := cmd.Args[0]

	user, err := s.Db.CreateUser(
		context.Background(),
		database.CreateUserParams{
			ID:        uuid.New(),
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
			Name:      name,
		},
	)
	if err != nil {
		if strings.Contains(err.Error(), "unique constraint") {
			fmt.Fprintf(os.Stderr, "User %s already exists\n", name)
			os.Exit(1)
		}
		return fmt.Errorf("failed to create user: %w", err)
	}

	err = s.Cfg.SetUser(name)
	if err != nil {
		return fmt.Errorf("couldn't set current user: %w", err)
	}

	fmt.Printf("User %v Registered successfully!\n", name)
	fmt.Printf("User ID: %v\n", user.ID)
	fmt.Printf("Created At: %v | Updated At: %v\n", user.CreatedAt, user.UpdatedAt)
	return nil
}

func HandlerReset(s *State, cmd Command) error {
	err := s.Db.ResetUsers(context.Background())
	if err != nil {
		return fmt.Errorf("failed to reset users: %w", err)
	}
	fmt.Println("Users reset successfully.")
	return nil
}

func HandlerGetUsers(s *State, cmd Command) error {
	// use config.Read() instead of s.cfg.Read()
	cfg, err := config.Read()
	if err != nil {
		return fmt.Errorf("failed to read config: %w", err)
	}
	currentUser := cfg.CurrentUserName

	users, err := s.Db.GetUsers(context.Background())
	if err != nil {
		return fmt.Errorf("failed to get users: %w", err)
	}
	for _, user := range users {
		if user.Name == currentUser {
			fmt.Printf("* %s (current)\n", user.Name)
		} else {
			fmt.Printf("* %s\n", user.Name)
		}
	}
	return nil
}

func requireLogin(s *State) error {
	cfg, err := config.Read()
	if err != nil {
		return fmt.Errorf("failed to read config: %w", err)
	}
	currentUser := cfg.CurrentUserName
	if currentUser == "" {
		return errors.New("you must be logged in to do that")
	}
	return nil
}

func HandlerHelp(s *State, cmd Command) error {
	if len(cmd.Args) != 0 {
		return errors.New("usage: <help>")
	}
	// Split these up into sections
	fmt.Println("Help Menu:")
	fmt.Println("--- User Management ---")
	fmt.Println("help      | go run . help                    | Displays the help menu & commands")
	fmt.Println("login     | go run . login <name>            | Logs in <name> user")
	fmt.Println("register  | go run . register <name>         | Registers <name> user")
	fmt.Println("users     | go run . users                   | Lists users including (current) signifier")
	fmt.Println("reset     | go run . reset                   | Resets all tables")
	fmt.Println("--- Feed Management ---")
	// LOOK INTO THESE, USE LOGIN HANDLER for ADDFEED? Remove exclusivity? Add more searches / paging
	fmt.Println("addfeed   | go run . addfeed <name> <url>    | Adds <url>(feed) to current signed in user as an RSSfeed named <name>")
	fmt.Println("agg       | go run . agg <time_between_reqs> | Pulls RSSdata from your feeds with a <time_between_reqs> refresher - CTRL + C to stop")
	fmt.Println("follow    | go run . follow <url>            | Follows <url> as current signed in user")
	fmt.Println("unfollow  | go run . unfollow <url>          | Unfollows <url> as current signed in user")
	fmt.Println("feeds     | go run . feeds                   | Lists all feeds and their 'main' user")
	fmt.Println("following | go run . following               | Lists the current users followed URLs/RSSfeeds")
	fmt.Println("browse    | go run . browse <limit (def: 2)> | Lists the newest posts in current users feed")
	return nil
}

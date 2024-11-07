package main

import (
	"context"

	"github.com/LFroesch/Gator/internal/database"
)

func middlewareLoggedIn(handler func(s *state, cmd command, user database.User) error) func(*state, command) error {
	// The returned function receives a state and a command
	return func(s *state, cmd command) error {
		// Attempt to retrieve the user
		user, err := s.db.GetUser(context.Background(), s.cfg.CurrentUserName)
		if err != nil {
			// Handle the error if user retrieval fails
			return err
		}

		// Call the wrapped handler with the retrieved user
		return handler(s, cmd, user)
	}
}

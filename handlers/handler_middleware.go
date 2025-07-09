package handlers

import (
	"context"

	"github.com/LFroesch/Gator/internal/database"
)

func MiddlewareLoggedIn(handler func(s *State, cmd Command, user database.User) error) func(*State, Command) error {
	// The returned function receives a state and a command
	return func(s *State, cmd Command) error {
		// Attempt to retrieve the user
		user, err := s.Db.GetUser(context.Background(), s.Cfg.CurrentUserName)
		if err != nil {
			// Handle the error if user retrieval fails
			return err
		}

		// Call the wrapped handler with the retrieved user
		return handler(s, cmd, user)
	}
}

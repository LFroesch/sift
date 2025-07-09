package handlers

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/LFroesch/Gator/internal/config"
	"github.com/LFroesch/Gator/internal/database"
	"github.com/google/uuid"
)

func HandlerFollow(s *State, cmd Command, user database.User) error {

	if len(cmd.Args) != 1 {
		return errors.New("you must provide a URL to follow")
	}

	url := cmd.Args[0]

	feed, err := s.Db.GetFeedByURL(context.Background(), url)
	if err != nil {
		return fmt.Errorf("couldn't get feed: %w", err)
	}

	cfg, err := config.Read()
	if err != nil {
		return fmt.Errorf("failed to read config: %w", err)
	}

	user, err = s.Db.GetUser(context.Background(), cfg.CurrentUserName)
	if err != nil {
		return fmt.Errorf("couldn't get user: %w", err)
	}

	id := uuid.New()
	now := time.Now()

	feedFollow, err := s.Db.CreateFeedFollow(context.Background(), database.CreateFeedFollowParams{
		ID:        id,
		CreatedAt: now,
		UpdatedAt: now,
		UserID:    user.ID,
		FeedID:    feed.ID,
	})
	if err != nil {
		return fmt.Errorf("failed to create feed follow: %w", err)
	}

	fmt.Printf("Following '%v' as '%v'\n", feedFollow.FeedName, feedFollow.UserName)
	return nil
}

func HandlerFollowing(s *State, cmd Command, user database.User) error {
	if len(cmd.Args) != 0 {
		return errors.New("usage <following> reports follow list for current user")
	}

	follows, err := s.Db.GetFeedFollowsByUser(context.Background(), user.ID)
	if err != nil {
		return fmt.Errorf("couldn't get follows: %w", err)
	}
	if len(follows) == 0 {
		fmt.Println("No feed follows found for this user.")
		return nil
	}
	fmt.Printf("Feed follows for user %s:\n", user.Name)
	for _, ffollow := range follows {
		fmt.Printf("* %s\n", ffollow.FeedName)
	}
	return nil
}

// In handlers/handler_follow.go - just replace the HandlerUnfollow function:

func HandlerUnfollow(s *State, cmd Command, user database.User) error {
	if len(cmd.Args) != 1 {
		return fmt.Errorf("usage: %s <feed_url>", cmd.Name)
	}

	feed, err := s.Db.GetFeedByURL(context.Background(), cmd.Args[0])
	if err != nil {
		return fmt.Errorf("couldn't get feed: %w", err)
	}

	err = s.Db.DeleteFeedFollowByUserAndFeed(context.Background(), database.DeleteFeedFollowByUserAndFeedParams{
		UserID: user.ID,
		FeedID: feed.ID,
	})
	if err != nil {
		return fmt.Errorf("couldn't delete feed follow: %w", err)
	}
	return nil
}

func printFeedFollow(username, feedname string) {
	fmt.Printf("* User:          %s\n", username)
	fmt.Printf("* Feed:          %s\n", feedname)
}

package main

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/LFroesch/Gator/internal/config"
	"github.com/LFroesch/Gator/internal/database"
	"github.com/google/uuid"
)

func handlerFollow(s *state, cmd command, user database.User) error {
	if err := requireLogin(s); err != nil {
		return err
	}

	if len(cmd.Args) != 1 {
		return errors.New("you must provide a URL to follow")
	}

	url := cmd.Args[0]

	feed, err := s.db.GetFeedByURL(context.Background(), url)
	if err != nil {
		return fmt.Errorf("couldn't get feed: %w", err)
	}

	cfg, err := config.Read()
	if err != nil {
		return fmt.Errorf("failed to read config: %w", err)
	}

	user, err = s.db.GetUser(context.Background(), cfg.CurrentUserName)
	if err != nil {
		return fmt.Errorf("couldn't get user: %w", err)
	}

	id := uuid.New()
	now := time.Now()

	feedFollow, err := s.db.CreateFeedFollow(context.Background(), database.CreateFeedFollowParams{
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

func handlerFollowing(s *state, cmd command, user database.User) error {
	if err := requireLogin(s); err != nil {
		return err
	}

	if len(cmd.Args) != 0 {
		return errors.New("usage <following> reports follow list for current user")
	}

	cfg, err := config.Read()
	if err != nil {
		return fmt.Errorf("failed to read config: %w", err)
	}

	user, err = s.db.GetUser(context.Background(), cfg.CurrentUserName)
	if err != nil {
		return fmt.Errorf("couldn't get user: %w", err)
	}

	follows, err := s.db.GetFeedFollowsByUser(context.Background(), user.ID)
	if err != nil {
		return fmt.Errorf("couldn't get follows: %w", err)
	}
	for _, follow := range follows {
		fmt.Println(follow.Name)
	}
	return nil
}

func handlerUnfollow(s *state, cmd command, user database.User) error {
	if len(cmd.Args) != 1 {
		return errors.New("you must provide a URL to unfollow")
	}

	params := database.DeleteFeedFollowByUserAndURLParams{
		UserID: user.ID,
		Url:    cmd.Args[0],
	}

	_, err := s.db.DeleteFeedFollowByUserAndURL(context.Background(), params)
	if err != nil {
		return fmt.Errorf("couldn't delete feed: %w", err)
	}
	return nil
}

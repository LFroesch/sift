package api

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"time"

	"github.com/LFroesch/Gator/internal/database"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Server struct {
	db *database.Queries
}

func NewServer(db *database.Queries) *Server {
	return &Server{db: db}
}

func (s *Server) Start(port string) error {
	r := gin.Default()

	// CORS middleware
	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:5173"},
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		MaxAge:           12 * time.Hour,
	}))

	// API routes
	api := r.Group("/api")
	{
		// User routes
		api.POST("/users", s.createUser)
		api.GET("/users", s.getUsers)
		api.GET("/users/:name", s.getUser)

		// Feed routes
		api.POST("/feeds", s.createFeed)
		api.GET("/feeds", s.getAllFeeds)

		// Feed follow routes
		api.POST("/follows", s.followFeed)
		api.GET("/follows/:userId", s.getUserFollows)
		api.DELETE("/follows/:userId/:feedUrl", s.unfollowFeed)

		// Post routes
		api.GET("/posts/:userId", s.getUserPosts)
	}

	return r.Run(":" + port)
}

// User handlers
func (s *Server) createUser(c *gin.Context) {
	var req struct {
		Name string `json:"name" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := s.db.CreateUser(context.Background(), database.CreateUserParams{
		ID:        uuid.New(),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		Name:      req.Name,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, user)
}

func (s *Server) getUsers(c *gin.Context) {
	users, err := s.db.GetUsers(context.Background())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, users)
}

func (s *Server) getUser(c *gin.Context) {
	name := c.Param("name")
	user, err := s.db.GetUser(context.Background(), name)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "User not found"})
		return
	}

	c.JSON(http.StatusOK, user)
}

// Feed handlers
func (s *Server) createFeed(c *gin.Context) {
	var req struct {
		Name   string `json:"name" binding:"required"`
		URL    string `json:"url" binding:"required"`
		UserID string `json:"user_id" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	feed, err := s.db.CreateFeed(context.Background(), database.CreateFeedParams{
		ID:        uuid.New(),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		Name:      req.Name,
		Url:       req.URL,
		UserID:    userID,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, feed)
}

func (s *Server) getAllFeeds(c *gin.Context) {
	feeds, err := s.db.GetAllFeeds(context.Background())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, feeds)
}

// Feed follow handlers
func (s *Server) followFeed(c *gin.Context) {
	var req struct {
		UserID  string `json:"user_id" binding:"required"`
		FeedURL string `json:"feed_url" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	fmt.Printf("Follow request: UserID=%s, FeedURL=%s\n", req.UserID, req.FeedURL) // Debug

	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Get feed by URL first
	feed, err := s.db.GetFeedByURL(context.Background(), req.FeedURL)
	if err != nil {
		fmt.Printf("Feed not found for URL: %s, error: %v\n", req.FeedURL, err) // Debug
		c.JSON(http.StatusBadRequest, gin.H{"error": "Feed not found"})
		return
	}

	fmt.Printf("Found feed: ID=%s, Name=%s\n", feed.ID, feed.Name) // Debug

	follow, err := s.db.CreateFeedFollow(context.Background(), database.CreateFeedFollowParams{
		ID:        uuid.New(),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		UserID:    userID,
		FeedID:    feed.ID,
	})

	if err != nil {
		fmt.Printf("Error creating follow: %v\n", err) // Debug
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	fmt.Printf("Follow created successfully\n") // Debug
	c.JSON(http.StatusCreated, follow)
}

func (s *Server) getUserFollows(c *gin.Context) {
	userIDStr := c.Param("userId")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	fmt.Printf("Getting follows for user ID: %s\n", userID) // Debug

	follows, err := s.db.GetFeedFollowsByUser(context.Background(), userID)
	if err != nil {
		fmt.Printf("Error getting follows: %v\n", err) // Debug
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	fmt.Printf("Found %d follows\n", len(follows)) // Debug
	c.JSON(http.StatusOK, follows)
}

func (s *Server) unfollowFeed(c *gin.Context) {
	userIDStr := c.Param("userId")
	feedURL := c.Param("feedUrl")

	// URL decode the feedURL since it might have encoded characters
	feedURL, err := url.QueryUnescape(feedURL)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid feed URL"})
		return
	}

	fmt.Printf("Unfollow request: UserID=%s, FeedURL=%s\n", userIDStr, feedURL)

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	feed, err := s.db.GetFeedByURL(context.Background(), feedURL)
	if err != nil {
		fmt.Printf("Feed not found for URL: %s, error: %v\n", feedURL, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Feed not found"})
		return
	}

	err = s.db.DeleteFeedFollowByUserAndFeed(context.Background(), database.DeleteFeedFollowByUserAndFeedParams{
		UserID: userID,
		FeedID: feed.ID,
	})

	if err != nil {
		fmt.Printf("Error deleting feed follow: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	fmt.Printf("Successfully unfollowed feed: %s\n", feed.Name)
	c.JSON(http.StatusOK, gin.H{"message": "Unfollowed successfully"})
}

// Post handlers
func (s *Server) getUserPosts(c *gin.Context) {
	userIDStr := c.Param("userId")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	limitStr := c.DefaultQuery("limit", "10")
	limit, err := strconv.Atoi(limitStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid limit"})
		return
	}

	posts, err := s.db.GetPostsForUser(context.Background(), database.GetPostsForUserParams{
		UserID: userID,
		Limit:  int32(limit),
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, posts)
}

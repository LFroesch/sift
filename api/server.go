package api

import (
	"compress/gzip"
	"context"
	"database/sql"
	"encoding/xml"
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/LFroesch/Gator/internal/database"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/text/encoding/charmap"
	"golang.org/x/text/transform"
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
		api.PUT("/users/:userId", s.updateUser)
		api.DELETE("/users/:userId", s.deleteUser)

		// Feed routes
		api.POST("/feeds", s.createFeed)
		api.GET("/feeds", s.getAllFeeds)
		api.PUT("/feeds/:feedId", s.updateFeed)
		api.DELETE("/feeds/:feedId", s.deleteFeed)

		// Feed follow routes
		api.POST("/follows", s.followFeed)
		api.GET("/follows/:userId", s.getUserFollows)
		api.DELETE("/follows/:userId", s.unfollowFeed)

		// Post routes
		api.GET("/posts/:userId", s.getUserPosts)

		// Bookmark routes
		api.POST("/bookmarks", s.createBookmark)
		api.DELETE("/bookmarks/:userId/:postId", s.deleteBookmark)
		api.GET("/bookmarks/:userId", s.getUserBookmarks)

		// Read status routes
		api.POST("/reads", s.markPostRead)
		api.DELETE("/reads/:userId/:postId", s.markPostUnread)

		// Feed fetch route
		api.POST("/feeds/fetch/:userId", s.fetchUserFeeds)
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

// User update handler
func (s *Server) updateUser(c *gin.Context) {
	userIDStr := c.Param("userId")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	var req struct {
		Name string `json:"name" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	user, err := s.db.UpdateUser(context.Background(), database.UpdateUserParams{
		ID:        userID,
		Name:      req.Name,
		UpdatedAt: time.Now(),
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, user)
}

// User delete handler
func (s *Server) deleteUser(c *gin.Context) {
	userIDStr := c.Param("userId")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	err = s.db.DeleteUser(context.Background(), userID)
	if err != nil {
		fmt.Printf("Error deleting user: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	fmt.Printf("Successfully deleted user: %s\n", userID)
	c.JSON(http.StatusOK, gin.H{"message": "User deleted successfully"})
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

// Feed update handler
func (s *Server) updateFeed(c *gin.Context) {
	feedIDStr := c.Param("feedId")
	feedID, err := uuid.Parse(feedIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid feed ID"})
		return
	}

	var req struct {
		Name string `json:"name" binding:"required"`
		URL  string `json:"url" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	feed, err := s.db.UpdateFeed(context.Background(), database.UpdateFeedParams{
		ID:        feedID,
		Name:      req.Name,
		Url:       req.URL,
		UpdatedAt: time.Now(),
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, feed)
}

// Feed delete handler
func (s *Server) deleteFeed(c *gin.Context) {
	feedIDStr := c.Param("feedId")
	feedID, err := uuid.Parse(feedIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid feed ID"})
		return
	}

	err = s.db.DeleteFeed(context.Background(), feedID)
	if err != nil {
		fmt.Printf("Error deleting feed: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	fmt.Printf("Successfully deleted feed: %s\n", feedID)
	c.JSON(http.StatusOK, gin.H{"message": "Feed deleted successfully"})
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

	fmt.Printf("Follow request: UserID=%s, FeedURL=%s\n", req.UserID, req.FeedURL)

	userID, err := uuid.Parse(req.UserID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Get feed by URL first
	feed, err := s.db.GetFeedByURL(context.Background(), req.FeedURL)
	if err != nil {
		fmt.Printf("Feed not found for URL: %s, error: %v\n", req.FeedURL, err)
		c.JSON(http.StatusBadRequest, gin.H{"error": "Feed not found"})
		return
	}

	fmt.Printf("Found feed: ID=%s, Name=%s\n", feed.ID, feed.Name)

	follow, err := s.db.CreateFeedFollow(context.Background(), database.CreateFeedFollowParams{
		ID:        uuid.New(),
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		UserID:    userID,
		FeedID:    feed.ID,
	})

	if err != nil {
		fmt.Printf("Error creating follow: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	fmt.Printf("Follow created successfully\n")
	c.JSON(http.StatusCreated, follow)
}

func (s *Server) getUserFollows(c *gin.Context) {
	userIDStr := c.Param("userId")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	fmt.Printf("Getting follows for user ID: %s\n", userID)

	follows, err := s.db.GetFeedFollowsByUser(context.Background(), userID)
	if err != nil {
		fmt.Printf("Error getting follows: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	fmt.Printf("Found %d follows\n", len(follows))
	c.JSON(http.StatusOK, follows)
}

func (s *Server) unfollowFeed(c *gin.Context) {
	userIDStr := c.Param("userId")
	feedURL := c.Query("feedUrl")

	fmt.Printf("Unfollow request: UserID=%s, FeedURL=%s\n", userIDStr, feedURL)

	if feedURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "feedUrl query parameter is required"})
		return
	}

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

	offsetStr := c.DefaultQuery("offset", "0")
	offset, err := strconv.Atoi(offsetStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid offset"})
		return
	}

	var posts []database.GetPostsForUserWithOffsetRow
	// Use offset-based pagination if offset is provided
	if offset > 0 {
		posts, err = s.db.GetPostsForUserWithOffset(context.Background(), database.GetPostsForUserWithOffsetParams{
			UserID: userID,
			Limit:  int32(limit),
			Offset: int32(offset),
		})
	} else {
		// Use the original query for backward compatibility
		postsOrig, err := s.db.GetPostsForUser(context.Background(), database.GetPostsForUserParams{
			UserID: userID,
			Limit:  int32(limit),
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		// Convert to the offset version structure for consistency
		posts = make([]database.GetPostsForUserWithOffsetRow, len(postsOrig))
		for i, post := range postsOrig {
			posts[i] = database.GetPostsForUserWithOffsetRow{
				ID:          post.ID,
				CreatedAt:   post.CreatedAt,
				UpdatedAt:   post.UpdatedAt,
				Title:       post.Title,
				Url:         post.Url,
				Description: post.Description,
				PublishedAt: post.PublishedAt,
				FeedName:    post.FeedName,
			}
		}
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	// Enhance posts with bookmark and read status
	type EnhancedPost struct {
		database.GetPostsForUserWithOffsetRow
		IsBookmarked bool `json:"is_bookmarked"`
		IsRead       bool `json:"is_read"`
	}

	enhancedPosts := make([]EnhancedPost, len(posts))
	for i, post := range posts {
		// Check if bookmarked
		isBookmarked, err := s.db.IsPostBookmarked(context.Background(), database.IsPostBookmarkedParams{
			UserID: userID,
			PostID: post.ID,
		})
		if err != nil {
			isBookmarked = false // Default to false on error
		}

		// Check if read
		isRead, err := s.db.IsPostRead(context.Background(), database.IsPostReadParams{
			UserID: userID,
			PostID: post.ID,
		})
		if err != nil {
			isRead = false // Default to false on error
		}

		enhancedPosts[i] = EnhancedPost{
			GetPostsForUserWithOffsetRow: post,
			IsBookmarked:                 isBookmarked,
			IsRead:                       isRead,
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"posts":   enhancedPosts,
		"limit":   limit,
		"offset":  offset,
		"hasMore": len(posts) == limit,
	})
}

// Bookmark handlers
func (s *Server) createBookmark(c *gin.Context) {
	var req struct {
		UserID string `json:"user_id" binding:"required"`
		PostID string `json:"post_id" binding:"required"`
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

	postID, err := uuid.Parse(req.PostID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
		return
	}

	now := time.Now()
	bookmark, err := s.db.CreateBookmark(c.Request.Context(), database.CreateBookmarkParams{
		ID:        uuid.New(),
		CreatedAt: now,
		UpdatedAt: now,
		UserID:    userID,
		PostID:    postID,
	})

	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			c.JSON(http.StatusConflict, gin.H{"error": "Post already bookmarked"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create bookmark"})
		return
	}

	c.JSON(http.StatusCreated, bookmark)
}

func (s *Server) deleteBookmark(c *gin.Context) {
	userIDStr := c.Param("userId")
	postIDStr := c.Param("postId")

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	postID, err := uuid.Parse(postIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
		return
	}

	err = s.db.DeleteBookmark(c.Request.Context(), database.DeleteBookmarkParams{
		UserID: userID,
		PostID: postID,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to delete bookmark"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Bookmark deleted successfully"})
}

func (s *Server) getUserBookmarks(c *gin.Context) {
	userIDStr := c.Param("userId")
	limitStr := c.DefaultQuery("limit", "10")
	offsetStr := c.DefaultQuery("offset", "0")

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 10
	}

	offset, err := strconv.Atoi(offsetStr)
	if err != nil || offset < 0 {
		offset = 0
	}

	bookmarks, err := s.db.GetUserBookmarks(c.Request.Context(), database.GetUserBookmarksParams{
		UserID: userID,
		Limit:  int32(limit),
		Offset: int32(offset),
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch bookmarks"})
		return
	}

	if bookmarks == nil {
		bookmarks = []database.GetUserBookmarksRow{}
	}

	c.JSON(http.StatusOK, gin.H{
		"bookmarks": bookmarks,
		"hasMore":   len(bookmarks) == limit,
	})
}

// Read status handlers
func (s *Server) markPostRead(c *gin.Context) {
	var req struct {
		UserID string `json:"user_id" binding:"required"`
		PostID string `json:"post_id" binding:"required"`
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

	postID, err := uuid.Parse(req.PostID)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
		return
	}

	now := time.Now()
	postRead, err := s.db.CreatePostRead(c.Request.Context(), database.CreatePostReadParams{
		ID:        uuid.New(),
		CreatedAt: now,
		UpdatedAt: now,
		UserID:    userID,
		PostID:    postID,
		ReadAt:    now,
	})

	if err != nil {
		if strings.Contains(err.Error(), "duplicate key") {
			c.JSON(http.StatusConflict, gin.H{"error": "Post already marked as read"})
			return
		}
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark post as read"})
		return
	}

	c.JSON(http.StatusCreated, postRead)
}

func (s *Server) markPostUnread(c *gin.Context) {
	userIDStr := c.Param("userId")
	postIDStr := c.Param("postId")

	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	postID, err := uuid.Parse(postIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
		return
	}

	err = s.db.DeletePostRead(c.Request.Context(), database.DeletePostReadParams{
		UserID: userID,
		PostID: postID,
	})

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to mark post as unread"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"message": "Post marked as unread successfully"})
}

// RSS Feed structures for parsing
type RSSFeed struct {
	Channel struct {
		Title       string    `xml:"title"`
		Link        string    `xml:"link"`
		Description string    `xml:"description"`
		Item        []RSSItem `xml:"item"`
	} `xml:"channel"`
}

type RSSItem struct {
	Title       string `xml:"title"`
	Link        string `xml:"link"`
	Description string `xml:"description"`
	PubDate     string `xml:"pubDate"`
}

// AtomFeed represents an Atom feed structure (used by Reddit, YouTube, etc.)
type AtomFeed struct {
	Title       string      `xml:"title"`
	Link        []AtomLink  `xml:"link"`
	Description string      `xml:"subtitle"`
	Entry       []AtomEntry `xml:"entry"`
}

type AtomLink struct {
	Href string `xml:"href,attr"`
	Rel  string `xml:"rel,attr"`
}

type AtomEntry struct {
	Title            string     `xml:"title"`
	Link             []AtomLink `xml:"link"`
	Content          string     `xml:"content"`
	Summary          string     `xml:"summary"`
	Published        string     `xml:"published"`
	Updated          string     `xml:"updated"`
	MediaDescription string     `xml:"http://search.yahoo.com/mrss/ description"`
}

// fetchUserFeeds - API endpoint to fetch new posts for a user's followed feeds
func (s *Server) fetchUserFeeds(c *gin.Context) {
	userIDStr := c.Param("userId")
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid user ID"})
		return
	}

	// Get user's followed feeds
	follows, err := s.db.GetFeedFollowsByUser(context.Background(), userID)
	if err != nil {
		log.Printf("Error getting user follows: %v", err)
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get user follows"})
		return
	}

	if len(follows) == 0 {
		c.JSON(http.StatusOK, gin.H{
			"message": "No feeds to fetch",
			"count":   0,
		})
		return
	}

	totalNewPosts := 0
	fetchedFeeds := 0

	// Fetch from each followed feed
	for _, follow := range follows {
		// Get the feed details
		feed, err := s.db.GetFeedByID(context.Background(), follow.FeedID)
		if err != nil {
			log.Printf("Error getting feed %s: %v", follow.FeedID, err)
			continue
		}

		// Fetch new posts from this feed
		newPosts, err := s.scrapeFeedForAPI(feed)
		if err != nil {
			log.Printf("Error scraping feed %s: %v", feed.Name, err)
			continue
		}

		totalNewPosts += newPosts
		fetchedFeeds++

		// Mark feed as fetched
		s.db.MarkFeedFetched(context.Background(), feed.ID)
	}

	c.JSON(http.StatusOK, gin.H{
		"message":      "Feeds fetched successfully",
		"feedsFetched": fetchedFeeds,
		"totalFeeds":   len(follows),
		"newPosts":     totalNewPosts,
	})
}

// scrapeFeedForAPI - Internal function to scrape a feed and return count of new posts
func (s *Server) scrapeFeedForAPI(feed database.Feed) (int, error) {
	feedData, err := s.fetchRSSFeed(context.Background(), feed.Url)
	if err != nil {
		return 0, fmt.Errorf("couldn't fetch feed %s: %w", feed.Name, err)
	}

	newPosts := 0
	for _, item := range feedData.Channel.Item {
		publishedAt := sql.NullTime{}

		// Try parsing different date formats
		if item.PubDate != "" {
			// Try RFC1123Z first (RSS format)
			if t, err := time.Parse(time.RFC1123Z, item.PubDate); err == nil {
				publishedAt = sql.NullTime{Time: t, Valid: true}
			} else if t, err := time.Parse(time.RFC1123, item.PubDate); err == nil {
				publishedAt = sql.NullTime{Time: t, Valid: true}
			} else if t, err := time.Parse(time.RFC3339, item.PubDate); err == nil {
				// Atom format (ISO 8601)
				publishedAt = sql.NullTime{Time: t, Valid: true}
			} else if t, err := time.Parse("2006-01-02T15:04:05Z", item.PubDate); err == nil {
				// Alternative ISO format
				publishedAt = sql.NullTime{Time: t, Valid: true}
			}
		}

		_, err = s.db.CreatePost(context.Background(), database.CreatePostParams{
			ID:        uuid.New(),
			CreatedAt: time.Now().UTC(),
			UpdatedAt: time.Now().UTC(),
			FeedID:    feed.ID,
			Title:     item.Title,
			Description: sql.NullString{
				String: item.Description,
				Valid:  true,
			},
			Url:         item.Link,
			PublishedAt: publishedAt,
		})
		if err != nil {
			if strings.Contains(err.Error(), "duplicate key value violates unique constraint") {
				continue // Post already exists, skip
			}
			log.Printf("Couldn't create post: %v", err)
			continue
		}
		newPosts++
	}

	log.Printf("Feed %s scraped, %d new posts added", feed.Name, newPosts)
	return newPosts, nil
}

// fetchRSSFeed - Fetch and parse RSS feed
func (s *Server) fetchRSSFeed(ctx context.Context, feedURL string) (*RSSFeed, error) {
	request, err := http.NewRequestWithContext(ctx, "GET", feedURL, nil)
	if err != nil {
		return nil, err
	}

	// Set headers that make the request appear more legitimate to avoid being blocked
	request.Header.Set("User-Agent", "Mozilla/5.0 (compatible; Gator RSS Reader/1.0; +https://github.com/user/gator)")
	request.Header.Set("Accept", "application/rss+xml, application/atom+xml, application/xml, text/xml, */*")
	request.Header.Set("Accept-Language", "en-US,en;q=0.9")
	request.Header.Set("Accept-Encoding", "gzip, deflate")
	request.Header.Set("Cache-Control", "no-cache")
	request.Header.Set("Connection", "keep-alive")

	client := &http.Client{Timeout: 30 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	// Handle gzipped responses
	var reader io.Reader = response.Body
	if response.Header.Get("Content-Encoding") == "gzip" {
		gzipReader, err := gzip.NewReader(response.Body)
		if err != nil {
			return nil, err
		}
		defer gzipReader.Close()
		reader = gzipReader
	}

	body, err := io.ReadAll(reader)
	if err != nil {
		return nil, err
	}

	// Handle different character encodings
	bodyStr := string(body)
	if strings.Contains(bodyStr, `encoding="ISO-8859-1"`) {
		decoder := charmap.ISO8859_1.NewDecoder()
		utf8Body, err := io.ReadAll(transform.NewReader(strings.NewReader(bodyStr), decoder))
		if err != nil {
			log.Printf("Warning: Failed to convert from ISO-8859-1: %v", err)
		} else {
			// Fix the encoding declaration in the XML
			bodyStr = string(utf8Body)
			bodyStr = strings.Replace(bodyStr, `encoding="ISO-8859-1"`, `encoding="UTF-8"`, 1)
			body = []byte(bodyStr)
		}
	}

	// Clean up common XML issues before parsing
	bodyStr = string(body)
	bodyStr = s.cleanXML(bodyStr)

	// Parse the XML - try RSS first, then Atom
	var feed RSSFeed
	err = xml.Unmarshal([]byte(bodyStr), &feed)
	if err != nil || feed.Channel.Title == "" {
		// If RSS parsing failed or didn't find channel, try Atom format
		var atomFeed AtomFeed
		err = xml.Unmarshal([]byte(bodyStr), &atomFeed)
		if err != nil {
			return nil, fmt.Errorf("XML parsing error: %w", err)
		}

		// Convert Atom to RSS format
		feed.Channel.Title = atomFeed.Title
		feed.Channel.Description = atomFeed.Description

		// Find the alternate link
		for _, link := range atomFeed.Link {
			if link.Rel == "alternate" || link.Rel == "" {
				feed.Channel.Link = link.Href
				break
			}
		}

		// Convert entries to items
		feed.Channel.Item = make([]RSSItem, len(atomFeed.Entry))
		for i, entry := range atomFeed.Entry {
			feed.Channel.Item[i].Title = entry.Title

			// Find the entry link
			for _, link := range entry.Link {
				if link.Rel == "alternate" || link.Rel == "" {
					feed.Channel.Item[i].Link = link.Href
					break
				}
			}

			// Use content, summary, or media description for description
			if entry.Content != "" {
				feed.Channel.Item[i].Description = entry.Content
			} else if entry.Summary != "" {
				feed.Channel.Item[i].Description = entry.Summary
			} else if entry.MediaDescription != "" {
				feed.Channel.Item[i].Description = entry.MediaDescription
			}

			// Use published or updated for date
			if entry.Published != "" {
				feed.Channel.Item[i].PubDate = entry.Published
			} else {
				feed.Channel.Item[i].PubDate = entry.Updated
			}
		}
	}

	// Unescape HTML entities and clean up descriptions
	feed.Channel.Title = html.UnescapeString(feed.Channel.Title)
	feed.Channel.Description = html.UnescapeString(feed.Channel.Description)
	for i := range feed.Channel.Item {
		feed.Channel.Item[i].Title = html.UnescapeString(feed.Channel.Item[i].Title)
		feed.Channel.Item[i].Description = s.cleanDescription(html.UnescapeString(feed.Channel.Item[i].Description))
	}

	return &feed, nil
}

// cleanDescription removes HTML tags and cleans up RSS feed descriptions
func (s *Server) cleanDescription(description string) string {
	// Special handling for Hacker News style feeds
	if strings.Contains(description, "Article URL:") && strings.Contains(description, "Comments URL:") {
		return s.extractHackerNewsDescription(description)
	}

	// First, unescape HTML entities so we can properly match HTML tags
	unescaped := html.UnescapeString(description)

	// Remove HTML comments
	commentRegex := regexp.MustCompile(`<!--[\s\S]*?-->`)
	unescaped = commentRegex.ReplaceAllString(unescaped, "")

	// Remove Reddit-specific markers
	unescaped = strings.ReplaceAll(unescaped, "<!-- SC_OFF -->", "")
	unescaped = strings.ReplaceAll(unescaped, "<!-- SC_ON -->", "")

	// Remove HTML tags - more comprehensive regex
	htmlTagRegex := regexp.MustCompile(`<[^>]*>`)
	cleaned := htmlTagRegex.ReplaceAllString(unescaped, "")

	// Decode common HTML entities that might remain
	cleaned = strings.ReplaceAll(cleaned, "&amp;", "&")
	cleaned = strings.ReplaceAll(cleaned, "&lt;", "<")
	cleaned = strings.ReplaceAll(cleaned, "&gt;", ">")
	cleaned = strings.ReplaceAll(cleaned, "&quot;", "\"")
	cleaned = strings.ReplaceAll(cleaned, "&#39;", "'")
	cleaned = strings.ReplaceAll(cleaned, "&nbsp;", " ")

	// Remove extra whitespace and newlines
	cleaned = strings.TrimSpace(cleaned)
	cleaned = regexp.MustCompile(`\s+`).ReplaceAllString(cleaned, " ")

	// Remove common RSS feed artifacts
	cleaned = strings.ReplaceAll(cleaned, "\n", " ")
	cleaned = strings.ReplaceAll(cleaned, "\r", " ")
	cleaned = strings.ReplaceAll(cleaned, "\t", " ")

	// Remove Reddit submission line (submitted by /u/username)
	submittedRegex := regexp.MustCompile(`\s*submitted by\s+/u/\w+\s*`)
	cleaned = submittedRegex.ReplaceAllString(cleaned, "")

	// Remove [link] and [comments] markers at the end
	linkCommentsRegex := regexp.MustCompile(`\s*\[link\]\s*\[comments\]\s*$`)
	cleaned = linkCommentsRegex.ReplaceAllString(cleaned, "")

	// Clean up any remaining extra spaces
	cleaned = regexp.MustCompile(`\s+`).ReplaceAllString(cleaned, " ")
	cleaned = strings.TrimSpace(cleaned)

	return cleaned
}

// cleanXML fixes common XML parsing issues in RSS feeds
func (s *Server) cleanXML(xmlContent string) string {
	// Fix unclosed hr tags and similar issues
	xmlContent = regexp.MustCompile(`<hr[^>]*>`).ReplaceAllString(xmlContent, "<hr/>")
	xmlContent = regexp.MustCompile(`<br[^>]*>`).ReplaceAllString(xmlContent, "<br/>")
	xmlContent = regexp.MustCompile(`<img([^>]*)>`).ReplaceAllString(xmlContent, "<img$1/>")
	xmlContent = regexp.MustCompile(`<input([^>]*)>`).ReplaceAllString(xmlContent, "<input$1/>")

	// Remove or fix other common problematic elements
	xmlContent = strings.ReplaceAll(xmlContent, "&", "&amp;")
	xmlContent = strings.ReplaceAll(xmlContent, "&amp;amp;", "&amp;")
	xmlContent = strings.ReplaceAll(xmlContent, "&amp;lt;", "&lt;")
	xmlContent = strings.ReplaceAll(xmlContent, "&amp;gt;", "&gt;")
	xmlContent = strings.ReplaceAll(xmlContent, "&amp;quot;", "&quot;")

	return xmlContent
}

// extractHackerNewsDescription extracts meaningful content from Hacker News style descriptions
func (s *Server) extractHackerNewsDescription(description string) string {
	// For Hacker News style feeds, we'll create a more meaningful description
	// Extract the title from the link if possible, or provide a summary

	// Remove HTML tags first
	htmlTagRegex := regexp.MustCompile(`<[^>]*>`)
	plainText := htmlTagRegex.ReplaceAllString(description, "")

	// Extract article URL
	articleURLRegex := regexp.MustCompile(`Article URL:\s*([^\s]+)`)
	matches := articleURLRegex.FindStringSubmatch(plainText)

	var result string
	if len(matches) > 1 {
		articleURL := matches[1]
		// Try to extract a meaningful description from the URL
		if strings.Contains(articleURL, "github.com") {
			result = "GitHub repository: " + s.extractGitHubRepoInfo(articleURL)
		} else if strings.Contains(articleURL, "arxiv.org") {
			result = "Research paper from arXiv"
		} else if strings.Contains(articleURL, "youtube.com") || strings.Contains(articleURL, "youtu.be") {
			result = "YouTube video"
		} else {
			// Extract domain for a generic description
			domainRegex := regexp.MustCompile(`https?://([^/]+)`)
			domainMatches := domainRegex.FindStringSubmatch(articleURL)
			if len(domainMatches) > 1 {
				domain := domainMatches[1]
				result = fmt.Sprintf("Article from %s", domain)
			} else {
				result = "External article"
			}
		}
	} else {
		result = "Hacker News discussion"
	}

	// Add points and comments info if available
	pointsRegex := regexp.MustCompile(`Points:\s*(\d+)`)
	commentsRegex := regexp.MustCompile(`#\s*Comments:\s*(\d+)`)

	pointsMatches := pointsRegex.FindStringSubmatch(plainText)
	commentsMatches := commentsRegex.FindStringSubmatch(plainText)

	if len(pointsMatches) > 1 && len(commentsMatches) > 1 {
		result += fmt.Sprintf(" • %s points, %s comments", pointsMatches[1], commentsMatches[1])
	}

	return result
}

// extractGitHubRepoInfo extracts repository name from GitHub URL
func (s *Server) extractGitHubRepoInfo(url string) string {
	repoRegex := regexp.MustCompile(`github\.com/([^/]+)/([^/?]+)`)
	matches := repoRegex.FindStringSubmatch(url)
	if len(matches) > 2 {
		return fmt.Sprintf("%s/%s", matches[1], matches[2])
	}
	return url
}

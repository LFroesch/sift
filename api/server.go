package api

import (
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

	// Use offset-based pagination if offset is provided
	if offset > 0 {
		posts, err := s.db.GetPostsForUserWithOffset(context.Background(), database.GetPostsForUserWithOffsetParams{
			UserID: userID,
			Limit:  int32(limit),
			Offset: int32(offset),
		})

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"posts":   posts,
			"limit":   limit,
			"offset":  offset,
			"hasMore": len(posts) == limit, // Simple check if there might be more
		})
	} else {
		// Use the original query for backward compatibility
		posts, err := s.db.GetPostsForUser(context.Background(), database.GetPostsForUserParams{
			UserID: userID,
			Limit:  int32(limit),
		})

		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"posts":   posts,
			"limit":   limit,
			"offset":  offset,
			"hasMore": len(posts) == limit,
		})
	}
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
		if t, err := time.Parse(time.RFC1123Z, item.PubDate); err == nil {
			publishedAt = sql.NullTime{
				Time:  t,
				Valid: true,
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
	request.Header.Add("User-Agent", "gator")

	client := &http.Client{Timeout: 30 * time.Second}
	response, err := client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	body, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, err
	}

	// Clean up common XML issues before parsing
	bodyStr := string(body)
	bodyStr = s.cleanXML(bodyStr)

	var feed RSSFeed
	err = xml.Unmarshal([]byte(bodyStr), &feed)
	if err != nil {
		return nil, fmt.Errorf("XML parsing error: %w", err)
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

	// Remove HTML tags
	htmlTagRegex := regexp.MustCompile(`<[^>]*>`)
	cleaned := htmlTagRegex.ReplaceAllString(description, "")

	// Remove extra whitespace and newlines
	cleaned = strings.TrimSpace(cleaned)
	cleaned = regexp.MustCompile(`\s+`).ReplaceAllString(cleaned, " ")

	// Remove common RSS feed artifacts
	cleaned = strings.ReplaceAll(cleaned, "&nbsp;", " ")
	cleaned = strings.ReplaceAll(cleaned, "\n", " ")
	cleaned = strings.ReplaceAll(cleaned, "\r", " ")

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

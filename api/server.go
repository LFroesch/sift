package api

import (
	"compress/gzip"
	"context"
	"encoding/xml"
	"fmt"
	"html"
	"io"
	"log"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/LFroesch/Sift/internal/database"
	readability "github.com/go-shiori/go-readability"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"golang.org/x/text/encoding/charmap"
	"golang.org/x/text/transform"
)

// sentinel so callers can distinguish clean shutdown from real errors
var ErrServerClosed = http.ErrServerClosed

type Server struct {
	db            *database.Queries
	fetchInterval string
	ogCache       sync.Map // url -> string (og:image URL or "")
}

func NewServer(db *database.Queries, fetchInterval string) *Server {
	return &Server{db: db, fetchInterval: fetchInterval}
}

func (s *Server) Start(ctx context.Context, port string) error {
	r := gin.Default()

	corsOrigin := os.Getenv("CORS_ORIGIN")
	if corsOrigin == "" {
		corsOrigin = "*"
	}
	origins := strings.Split(corsOrigin, ",")
	for i, o := range origins {
		origins[i] = strings.TrimSpace(o)
	}
	useWildcard := len(origins) == 1 && origins[0] == "*"

	r.Use(cors.New(cors.Config{
		AllowOrigins:     origins,
		AllowMethods:     []string{"GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"},
		AllowHeaders:     []string{"Origin", "Content-Type", "Accept"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: !useWildcard,
		MaxAge:           12 * time.Hour,
	}))

	api := r.Group("/api")
	{
		api.GET("/feeds", s.getFeeds)
		api.POST("/feeds", s.createFeed)
		api.PUT("/feeds/:id", s.updateFeed)
		api.DELETE("/feeds/:id", s.deleteFeed)

		api.GET("/posts", s.getPosts)
		api.GET("/search", s.searchPosts)
		api.GET("/bookmarks", s.getBookmarks)
		api.PATCH("/posts/:id/bookmark", s.toggleBookmark)
		api.PATCH("/posts/:id/read", s.markRead)
		api.PATCH("/posts/:id/unread", s.markUnread)

		api.GET("/stats", s.getStats)

		api.GET("/groups", s.getGroups)
		api.POST("/groups", s.createGroup)
		api.PUT("/groups/:id", s.updateGroup)
		api.DELETE("/groups/:id", s.deleteGroup)
		api.POST("/groups/:id/feeds/:feedId", s.addFeedToGroup)
		api.DELETE("/groups/:id/feeds/:feedId", s.removeFeedFromGroup)
		api.GET("/groups/:id/feeds", s.getFeedsByGroup)

		api.POST("/fetch", s.fetchAllFeeds)
		api.DELETE("/posts", s.deleteAllPosts)
		api.DELETE("/posts/read", s.deleteReadUnbookmarked)
		api.DELETE("/posts/unbookmarked", s.deleteUnbookmarked)
		api.GET("/og", s.getOGImage)
		api.GET("/article", s.getArticle)
	}

	s.startFetcher(ctx)

	srv := &http.Server{Addr: ":" + port, Handler: r}

	go func() {
		<-ctx.Done()
		shutdownCtx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := srv.Shutdown(shutdownCtx); err != nil {
			log.Printf("Shutdown error: %v", err)
		}
	}()

	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
}

// --- Feed handlers ---

func (s *Server) getFeeds(c *gin.Context) {
	feeds, err := s.db.GetAllFeeds(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	// Attach groups to each feed
	type feedWithGroups struct {
		database.Feed
		Groups []database.Group `json:"groups"`
	}
	result := make([]feedWithGroups, len(feeds))
	for i, f := range feeds {
		groups, err := s.db.GetGroupsByFeed(c.Request.Context(), f.ID)
		if err != nil {
			groups = []database.Group{}
		}
		if groups == nil {
			groups = []database.Group{}
		}
		result[i] = feedWithGroups{Feed: f, Groups: groups}
	}
	c.JSON(http.StatusOK, result)
}

func (s *Server) createFeed(c *gin.Context) {
	var req struct {
		Name string `json:"name" binding:"required"`
		URL  string `json:"url" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Resolve YouTube channel URLs to RSS feed URLs at creation time so we
	// don't scrape the YouTube page on every fetch cycle.
	resolvedURL := req.URL
	if strings.Contains(req.URL, "youtube.com") && !strings.Contains(req.URL, "feeds/videos.xml") {
		resolvedURL = resolveYouTubeURL(c.Request.Context(), req.URL)
	}

	feed, err := s.db.CreateFeed(c.Request.Context(), database.CreateFeedParams{
		Name: req.Name,
		Url:  resolvedURL,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, feed)
}

func (s *Server) updateFeed(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
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

	feed, err := s.db.UpdateFeed(c.Request.Context(), database.UpdateFeedParams{
		ID:   id,
		Name: req.Name,
		Url:  req.URL,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, feed)
}

func (s *Server) deleteFeed(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid feed ID"})
		return
	}

	if err := s.db.DeleteFeed(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Feed deleted"})
}

// --- Post handlers ---

func (s *Server) getPosts(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))
	feedIDStr := c.Query("feed_id")
	groupIDStr := c.Query("group_id")

	if groupIDStr != "" {
		groupID, err := uuid.Parse(groupIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid group ID"})
			return
		}
		posts, err := s.db.GetPostsByGroup(c.Request.Context(), database.GetPostsByGroupParams{
			GroupID: groupID,
			Limit:   int32(limit),
			Offset:  int32(offset),
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"posts": posts, "hasMore": len(posts) == limit})
		return
	}

	if feedIDStr != "" {
		feedID, err := uuid.Parse(feedIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid feed ID"})
			return
		}
		posts, err := s.db.GetPostsByFeed(c.Request.Context(), database.GetPostsByFeedParams{
			FeedID: feedID,
			Limit:  int32(limit),
			Offset: int32(offset),
		})
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"posts": posts, "hasMore": len(posts) == limit})
		return
	}

	posts, err := s.db.GetPosts(c.Request.Context(), database.GetPostsParams{
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"posts": posts, "hasMore": len(posts) == limit})
}

func (s *Server) searchPosts(c *gin.Context) {
	q := strings.TrimSpace(c.Query("q"))
	if q == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "q is required"})
		return
	}
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "40"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	posts, err := s.db.SearchPosts(c.Request.Context(), q, int32(limit), int32(offset))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"posts": posts, "hasMore": len(posts) == limit})
}

func (s *Server) getBookmarks(c *gin.Context) {
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	posts, err := s.db.GetBookmarkedPosts(c.Request.Context(), database.GetBookmarkedPostsParams{
		Limit:  int32(limit),
		Offset: int32(offset),
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"posts": posts, "hasMore": len(posts) == limit})
}

func (s *Server) toggleBookmark(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
		return
	}

	post, err := s.db.ToggleBookmark(c.Request.Context(), id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, post)
}

func (s *Server) markRead(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
		return
	}
	if err := s.db.MarkPostRead(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Marked read"})
}

func (s *Server) markUnread(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid post ID"})
		return
	}
	if err := s.db.MarkPostUnread(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Marked unread"})
}

func (s *Server) deleteAllPosts(c *gin.Context) {
	if err := s.db.DeleteAllPosts(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "All posts deleted"})
}

func (s *Server) deleteReadUnbookmarked(c *gin.Context) {
	if err := s.db.DeleteReadUnbookmarked(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Read non-bookmarked posts deleted"})
}

func (s *Server) deleteUnbookmarked(c *gin.Context) {
	if err := s.db.DeleteUnbookmarked(c.Request.Context()); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Non-bookmarked posts deleted"})
}

// --- Stats ---

func (s *Server) getStats(c *gin.Context) {
	groupIDStr := c.Query("group_id")

	if groupIDStr != "" {
		groupID, err := uuid.Parse(groupIDStr)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid group ID"})
			return
		}
		stats, err := s.db.GetStatsByGroup(c.Request.Context(), groupID)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, stats)
		return
	}

	stats, err := s.db.GetStats(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, stats)
}

// --- Group handlers ---

func (s *Server) getGroups(c *gin.Context) {
	groups, err := s.db.GetAllGroups(c.Request.Context())
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if groups == nil {
		groups = []database.Group{}
	}
	c.JSON(http.StatusOK, groups)
}

func (s *Server) createGroup(c *gin.Context) {
	var req struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	group, err := s.db.CreateGroup(c.Request.Context(), req.Name)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusCreated, group)
}

func (s *Server) updateGroup(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid group ID"})
		return
	}
	var req struct {
		Name string `json:"name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	group, err := s.db.UpdateGroup(c.Request.Context(), database.UpdateGroupParams{
		ID:   id,
		Name: req.Name,
	})
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, group)
}

func (s *Server) deleteGroup(c *gin.Context) {
	id, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid group ID"})
		return
	}
	if err := s.db.DeleteGroup(c.Request.Context(), id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Group deleted"})
}

func (s *Server) addFeedToGroup(c *gin.Context) {
	groupID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid group ID"})
		return
	}
	feedID, err := uuid.Parse(c.Param("feedId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid feed ID"})
		return
	}
	if err := s.db.AddFeedToGroup(c.Request.Context(), database.AddFeedToGroupParams{
		FeedID:  feedID,
		GroupID: groupID,
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Feed added to group"})
}

func (s *Server) removeFeedFromGroup(c *gin.Context) {
	groupID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid group ID"})
		return
	}
	feedID, err := uuid.Parse(c.Param("feedId"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid feed ID"})
		return
	}
	if err := s.db.RemoveFeedFromGroup(c.Request.Context(), database.RemoveFeedFromGroupParams{
		FeedID:  feedID,
		GroupID: groupID,
	}); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "Feed removed from group"})
}

func (s *Server) getFeedsByGroup(c *gin.Context) {
	groupID, err := uuid.Parse(c.Param("id"))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid group ID"})
		return
	}
	feeds, err := s.db.GetFeedsByGroup(c.Request.Context(), groupID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if feeds == nil {
		feeds = []database.Feed{}
	}
	c.JSON(http.StatusOK, feeds)
}

// --- Fetch logic ---

func (s *Server) fetchAllFeeds(c *gin.Context) {
	newPosts, fetchedFeeds, totalFeeds, err := s.fetchFeeds()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"newPosts":     newPosts,
		"feedsFetched": fetchedFeeds,
		"totalFeeds":   totalFeeds,
	})
}

func (s *Server) startFetcher(ctx context.Context) {
	interval, err := time.ParseDuration(s.fetchInterval)
	if err != nil {
		log.Printf("Invalid FETCH_INTERVAL %q, defaulting to 30m", s.fetchInterval)
		interval = 30 * time.Minute
	}

	go func() {
		select {
		case <-time.After(5 * time.Second):
		case <-ctx.Done():
			return
		}
		newPosts, fetched, total, err := s.fetchFeeds()
		if err != nil {
			log.Printf("Initial fetch error: %v", err)
		} else {
			log.Printf("Initial fetch: %d new posts from %d/%d feeds", newPosts, fetched, total)
		}

		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				newPosts, fetched, total, err := s.fetchFeeds()
				if err != nil {
					log.Printf("Fetch error: %v", err)
				} else if newPosts > 0 {
					log.Printf("Fetched %d new posts from %d/%d feeds", newPosts, fetched, total)
				}
			}
		}
	}()
}

func (s *Server) fetchFeeds() (int, int, int, error) {
	feeds, err := s.db.GetAllFeeds(context.Background())
	if err != nil {
		return 0, 0, 0, err
	}

	totalNew := 0
	fetched := 0

	var lastReddit time.Time
	for _, feed := range feeds {
		if strings.Contains(feed.Url, "reddit.com") {
			if since := time.Since(lastReddit); since < 2*time.Second {
				time.Sleep(2*time.Second - since)
			}
			lastReddit = time.Now()
		}
		n, err := s.scrapeFeed(feed)
		if err != nil {
			log.Printf("Error scraping %s: %v", feed.Name, err)
			continue
		}
		totalNew += n
		fetched++
		s.db.MarkFeedFetched(context.Background(), feed.ID)
	}

	return totalNew, fetched, len(feeds), nil
}

func (s *Server) scrapeFeed(feed database.Feed) (int, error) {
	feedData, err := s.fetchRSSFeed(context.Background(), feed.Url)
	if err != nil {
		return 0, fmt.Errorf("fetch %s: %w", feed.Name, err)
	}

	newPosts := 0
	for _, item := range feedData.Channel.Item {
		var publishedAt *time.Time
		if item.PubDate != "" {
			for _, format := range []string{time.RFC1123Z, time.RFC1123, time.RFC3339, "2006-01-02T15:04:05Z"} {
				if t, err := time.Parse(format, item.PubDate); err == nil {
					publishedAt = &t
					break
				}
			}
		}

		var desc *string
		if item.Description != "" {
			desc = &item.Description
		}

		var thumb *string
		if item.Thumbnail != "" {
			thumb = &item.Thumbnail
		}

		_, err = s.db.CreatePost(context.Background(), database.CreatePostParams{
			Title:        item.Title,
			Url:          strings.ReplaceAll(item.Link, "old.reddit.com", "www.reddit.com"),
			Description:  desc,
			PublishedAt:  publishedAt,
			FeedID:       feed.ID,
			ThumbnailUrl: thumb,
		})
		if err != nil {
			if strings.Contains(err.Error(), "duplicate key") {
				continue
			}
			log.Printf("Error creating post: %v", err)
			continue
		}
		newPosts++
	}

	return newPosts, nil
}

// --- RSS parsing ---

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
	Thumbnail   string // extracted after parse
}

type MediaContent struct {
	URL    string `xml:"url,attr"`
	Medium string `xml:"medium,attr"`
}

type MediaThumbnail struct {
	URL string `xml:"url,attr"`
}

type AtomFeed struct {
	Title string      `xml:"title"`
	Entry []AtomEntry `xml:"entry"`
}

type AtomEntry struct {
	Title     string     `xml:"title"`
	Link      []AtomLink `xml:"link"`
	Content   string     `xml:"content"`
	Summary   string     `xml:"summary"`
	Published string     `xml:"published"`
	Updated   string     `xml:"updated"`
	MediaDesc string     `xml:"http://search.yahoo.com/mrss/ description"`
}

type AtomLink struct {
	Href string `xml:"href,attr"`
	Rel  string `xml:"rel,attr"`
}

// rawRSSItem captures all the media namespace variants for thumbnail extraction
type rawRSSItem struct {
	Title          string           `xml:"title"`
	Link           string           `xml:"link"`
	Description    string           `xml:"description"`
	PubDate        string           `xml:"pubDate"`
	MediaContent   []MediaContent   `xml:"http://search.yahoo.com/mrss/ content"`
	MediaThumbnail []MediaThumbnail `xml:"http://search.yahoo.com/mrss/ thumbnail"`
	MediaGroup     *MediaGroup      `xml:"http://search.yahoo.com/mrss/ group"`
	Enclosure      struct {
		URL  string `xml:"url,attr"`
		Type string `xml:"type,attr"`
	} `xml:"enclosure"`
}

type rawRSSFeed struct {
	Channel struct {
		Title       string       `xml:"title"`
		Link        string       `xml:"link"`
		Description string       `xml:"description"`
		Item        []rawRSSItem `xml:"item"`
	} `xml:"channel"`
}

// MediaGroup captures nested media:group > media:thumbnail (YouTube uses this)
type MediaGroup struct {
	Thumbnail []MediaThumbnail `xml:"http://search.yahoo.com/mrss/ thumbnail"`
	Content   []MediaContent   `xml:"http://search.yahoo.com/mrss/ content"`
}

// rawAtomEntry with media support
type rawAtomEntry struct {
	Title          string           `xml:"title"`
	Link           []AtomLink       `xml:"link"`
	Content        string           `xml:"content"`
	Summary        string           `xml:"summary"`
	Published      string           `xml:"published"`
	Updated        string           `xml:"updated"`
	MediaDesc      string           `xml:"http://search.yahoo.com/mrss/ description"`
	MediaContent   []MediaContent   `xml:"http://search.yahoo.com/mrss/ content"`
	MediaThumbnail []MediaThumbnail `xml:"http://search.yahoo.com/mrss/ thumbnail"`
	MediaGroup     *MediaGroup      `xml:"http://search.yahoo.com/mrss/ group"`
}

type rawAtomFeed struct {
	Title string         `xml:"title"`
	Entry []rawAtomEntry `xml:"entry"`
}

var imgTagRe = regexp.MustCompile(`<img[^>]+src=["']([^"']+)["']`)

func extractThumbnail(item rawRSSItem) string {
	// 1. media:content with medium="image"
	for _, mc := range item.MediaContent {
		if mc.URL != "" && (mc.Medium == "image" || mc.Medium == "") {
			return mc.URL
		}
	}
	// 2. media:thumbnail
	for _, mt := range item.MediaThumbnail {
		if mt.URL != "" {
			return mt.URL
		}
	}
	// 3. nested media:group content/thumbnail
	if item.MediaGroup != nil {
		for _, mt := range item.MediaGroup.Thumbnail {
			if mt.URL != "" {
				return mt.URL
			}
		}
		for _, mc := range item.MediaGroup.Content {
			if mc.URL != "" && (mc.Medium == "image" || mc.Medium == "") {
				return mc.URL
			}
		}
	}
	// 4. enclosure with image type
	if item.Enclosure.URL != "" && strings.HasPrefix(item.Enclosure.Type, "image/") {
		return item.Enclosure.URL
	}
	// 5. first <img> in description
	if matches := imgTagRe.FindStringSubmatch(item.Description); len(matches) > 1 {
		return matches[1]
	}
	return ""
}

func extractAtomThumbnail(entry rawAtomEntry) string {
	// 1. Direct media:content
	for _, mc := range entry.MediaContent {
		if mc.URL != "" && (mc.Medium == "image" || mc.Medium == "") {
			return mc.URL
		}
	}
	// 2. Direct media:thumbnail
	for _, mt := range entry.MediaThumbnail {
		if mt.URL != "" {
			return mt.URL
		}
	}
	// 3. Nested media:group > media:thumbnail (YouTube)
	if entry.MediaGroup != nil {
		for _, mt := range entry.MediaGroup.Thumbnail {
			if mt.URL != "" {
				return mt.URL
			}
		}
		for _, mc := range entry.MediaGroup.Content {
			if mc.URL != "" && mc.Medium == "image" {
				return mc.URL
			}
		}
	}
	// 4. First <img> in content/summary
	content := entry.Content
	if content == "" {
		content = entry.Summary
	}
	if matches := imgTagRe.FindStringSubmatch(content); len(matches) > 1 {
		return matches[1]
	}
	return ""
}

var ytChannelRe = regexp.MustCompile(`(?i)youtube\.com/(?:channel/([a-zA-Z0-9_-]+)|@([a-zA-Z0-9_.-]+)|user/([a-zA-Z0-9_-]+))`)
var ytRSSChannelRe = regexp.MustCompile(`<link[^>]+rel=["']alternate["'][^>]+type=["']application/rss\+xml["'][^>]+href=["']([^"']+)["']`)

func resolveYouTubeURL(ctx context.Context, rawURL string) string {
	m := ytChannelRe.FindStringSubmatch(rawURL)
	if m == nil {
		return rawURL
	}
	// If it's already a channel_id (starts with UC), build feed URL directly
	if m[1] != "" {
		return "https://www.youtube.com/feeds/videos.xml?channel_id=" + m[1]
	}
	// For @handle or user/, fetch the page and extract the RSS link
	client := &http.Client{Timeout: 10 * time.Second}
	req, err := http.NewRequestWithContext(ctx, "GET", rawURL, nil)
	if err != nil {
		return rawURL
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; Sift/1.0)")
	resp, err := client.Do(req)
	if err != nil || resp.StatusCode >= 400 {
		return rawURL
	}
	defer resp.Body.Close()
	buf := make([]byte, 64*1024)
	n, _ := io.ReadAtLeast(resp.Body, buf, 1)
	body := string(buf[:n])
	if mm := ytRSSChannelRe.FindStringSubmatch(body); len(mm) > 1 {
		return html.UnescapeString(mm[1])
	}
	// Fallback: look for channel_id in page source
	if cidM := regexp.MustCompile(`"channelId":"(UC[a-zA-Z0-9_-]+)"`).FindStringSubmatch(body); len(cidM) > 1 {
		return "https://www.youtube.com/feeds/videos.xml?channel_id=" + cidM[1]
	}
	return rawURL
}

func (s *Server) fetchRSSFeed(ctx context.Context, feedURL string) (*RSSFeed, error) {
	// old.reddit.com serves RSS without bot-wall enforcement
	feedURL = strings.ReplaceAll(feedURL, "www.reddit.com", "old.reddit.com")

	req, err := http.NewRequestWithContext(ctx, "GET", feedURL, nil)
	if err != nil {
		return nil, err
	}

	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; Sift/1.0)")
	req.Header.Set("Accept", "application/rss+xml, application/atom+xml, application/xml, text/xml, */*")
	req.Header.Set("Accept-Encoding", "gzip, deflate")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var reader io.Reader = resp.Body
	if resp.Header.Get("Content-Encoding") == "gzip" {
		gr, err := gzip.NewReader(resp.Body)
		if err != nil {
			return nil, err
		}
		defer gr.Close()
		reader = gr
	}

	body, err := io.ReadAll(reader)
	if err != nil {
		return nil, err
	}

	// Handle ISO-8859-1 encoding
	bodyStr := string(body)
	if strings.Contains(bodyStr, `encoding="ISO-8859-1"`) {
		decoded, err := io.ReadAll(transform.NewReader(strings.NewReader(bodyStr), charmap.ISO8859_1.NewDecoder()))
		if err == nil {
			bodyStr = strings.Replace(string(decoded), `encoding="ISO-8859-1"`, `encoding="UTF-8"`, 1)
			body = []byte(bodyStr)
		}
	}

	bodyStr = cleanXML(string(body))

	// Detect HTML response (rate limit, error page, etc.)
	trimmed := strings.TrimSpace(bodyStr)
	if strings.HasPrefix(trimmed, "<!DOCTYPE") || strings.HasPrefix(trimmed, "<html") || strings.HasPrefix(trimmed, "<HTML") || strings.HasPrefix(trimmed, "<body") {
		snippet := trimmed
		if len(snippet) > 200 {
			snippet = snippet[:200]
		}
		return nil, fmt.Errorf("feed returned HTML instead of XML (possible rate limit or redirect): %s", snippet)
	}

	// Try RSS first with raw structs to capture media namespaces
	var rawFeed rawRSSFeed
	if err := xml.Unmarshal([]byte(bodyStr), &rawFeed); err == nil && rawFeed.Channel.Title != "" {
		feed := &RSSFeed{}
		feed.Channel.Title = rawFeed.Channel.Title
		feed.Channel.Link = rawFeed.Channel.Link
		feed.Channel.Description = rawFeed.Channel.Description
		feed.Channel.Item = make([]RSSItem, len(rawFeed.Channel.Item))
		for i, raw := range rawFeed.Channel.Item {
			feed.Channel.Item[i] = RSSItem{
				Title:       raw.Title,
				Link:        raw.Link,
				Description: raw.Description,
				PubDate:     raw.PubDate,
				Thumbnail:   extractThumbnail(raw),
			}
		}
		cleanFeedItems(feed)
		return feed, nil
	}

	// Try Atom
	var rawAtom rawAtomFeed
	if err := xml.Unmarshal([]byte(bodyStr), &rawAtom); err != nil {
		firstLine := bodyStr
		if idx := strings.Index(bodyStr, "\n"); idx > 0 {
			firstLine = bodyStr[:idx]
		}
		if len(firstLine) > 200 {
			firstLine = firstLine[:200]
		}
		return nil, fmt.Errorf("XML parse error: %w (first line: %s)", err, firstLine)
	}

	feed := &RSSFeed{}
	feed.Channel.Title = rawAtom.Title
	feed.Channel.Item = make([]RSSItem, len(rawAtom.Entry))
	for i, entry := range rawAtom.Entry {
		item := &feed.Channel.Item[i]
		item.Title = entry.Title
		item.Thumbnail = extractAtomThumbnail(entry)

		for _, link := range entry.Link {
			if link.Rel == "alternate" || link.Rel == "" {
				item.Link = link.Href
				break
			}
		}

		switch {
		case entry.Content != "":
			item.Description = entry.Content
		case entry.Summary != "":
			item.Description = entry.Summary
		case entry.MediaDesc != "":
			item.Description = entry.MediaDesc
		}

		if entry.Published != "" {
			item.PubDate = entry.Published
		} else {
			item.PubDate = entry.Updated
		}
	}

	cleanFeedItems(feed)
	return feed, nil
}

func cleanFeedItems(feed *RSSFeed) {
	feed.Channel.Title = html.UnescapeString(feed.Channel.Title)
	for i := range feed.Channel.Item {
		feed.Channel.Item[i].Title = html.UnescapeString(feed.Channel.Item[i].Title)
		feed.Channel.Item[i].Description = cleanDescription(html.UnescapeString(feed.Channel.Item[i].Description))
	}
}

var hnJunkRe = regexp.MustCompile(`(?i)Article URL:.*?(Comments URL:.*?)?(Points:.*?)?(#\s*Comments:.*?)?$`)

func cleanDescription(desc string) string {
	desc = html.UnescapeString(desc)
	desc = regexp.MustCompile(`<!--[\s\S]*?-->`).ReplaceAllString(desc, "")
	desc = regexp.MustCompile(`<[^>]*>`).ReplaceAllString(desc, "")
	desc = strings.NewReplacer("&amp;", "&", "&lt;", "<", "&gt;", ">", "&quot;", `"`, "&#39;", "'", "&nbsp;", " ").Replace(desc)
	desc = regexp.MustCompile(`\s+`).ReplaceAllString(desc, " ")
	desc = hnJunkRe.ReplaceAllString(desc, "")
	return strings.TrimSpace(desc)
}

// articleCache stores fetched article text: url -> string
var articleCacheMu sync.Map

func (s *Server) getArticle(c *gin.Context) {
	rawURL := c.Query("url")
	if rawURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "url required"})
		return
	}

	if cached, ok := articleCacheMu.Load(rawURL); ok {
		c.JSON(http.StatusOK, cached)
		return
	}

	article, err := readability.FromURL(rawURL, 15*time.Second)
	if err != nil {
		// Fall back to empty so the modal still shows description
		result := gin.H{"title": "", "text": "", "image": ""}
		articleCacheMu.Store(rawURL, result)
		c.JSON(http.StatusOK, result)
		return
	}

	result := gin.H{
		"title": article.Title,
		"text":  article.TextContent,
		"image": article.Image,
	}
	articleCacheMu.Store(rawURL, result)
	c.JSON(http.StatusOK, result)
}

var ogImageRe = regexp.MustCompile(`(?i)<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']|<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']`)

func (s *Server) getOGImage(c *gin.Context) {
	rawURL := c.Query("url")
	if rawURL == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "url required"})
		return
	}

	if cached, ok := s.ogCache.Load(rawURL); ok {
		c.JSON(http.StatusOK, gin.H{"image": cached})
		return
	}

	client := &http.Client{Timeout: 8 * time.Second}
	req, err := http.NewRequest("GET", rawURL, nil)
	if err != nil {
		s.ogCache.Store(rawURL, "")
		c.JSON(http.StatusOK, gin.H{"image": ""})
		return
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; Sift/1.0; +https://github.com/LFroesch/Sift)")
	req.Header.Set("Accept", "text/html")

	resp, err := client.Do(req)
	if err != nil || resp.StatusCode >= 400 {
		s.ogCache.Store(rawURL, "")
		c.JSON(http.StatusOK, gin.H{"image": ""})
		return
	}
	defer resp.Body.Close()

	// Read only first 32KB — OG tags are always in <head>
	buf := make([]byte, 32*1024)
	n, _ := io.ReadAtLeast(resp.Body, buf, 1)
	body := string(buf[:n])

	imageURL := ""
	if m := ogImageRe.FindStringSubmatch(body); len(m) > 1 {
		if m[1] != "" {
			imageURL = html.UnescapeString(m[1])
		} else if m[2] != "" {
			imageURL = html.UnescapeString(m[2])
		}
	}

	s.ogCache.Store(rawURL, imageURL)
	c.JSON(http.StatusOK, gin.H{"image": imageURL})
}

func cleanXML(s string) string {
	s = regexp.MustCompile(`<hr[^>]*>`).ReplaceAllString(s, "<hr/>")
	s = regexp.MustCompile(`<br[^>]*>`).ReplaceAllString(s, "<br/>")
	s = regexp.MustCompile(`<img([^>]*)>`).ReplaceAllString(s, "<img$1/>")
	s = regexp.MustCompile(`<input([^>]*)>`).ReplaceAllString(s, "<input$1/>")
	s = strings.ReplaceAll(s, "&", "&amp;")
	s = strings.ReplaceAll(s, "&amp;amp;", "&amp;")
	s = strings.ReplaceAll(s, "&amp;lt;", "&lt;")
	s = strings.ReplaceAll(s, "&amp;gt;", "&gt;")
	s = strings.ReplaceAll(s, "&amp;quot;", "&quot;")
	return s
}

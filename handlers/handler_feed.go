package handlers

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
	"strings"
	"time"

	"github.com/LFroesch/Gator/internal/database"
	"github.com/google/uuid"
)

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
	Title     string     `xml:"title"`
	Link      []AtomLink `xml:"link"`
	Content   string     `xml:"content"`
	Summary   string     `xml:"summary"`
	Published string     `xml:"published"`
	Updated   string     `xml:"updated"`
}

// cleanDescription removes HTML tags and cleans up feed descriptions
func cleanDescription(description string) string {
	// First, unescape HTML entities so we can properly match HTML tags
	unescaped := html.UnescapeString(description)

	// Remove HTML comments
	commentRegex := regexp.MustCompile(`<!--[\s\S]*?-->`)
	unescaped = commentRegex.ReplaceAllString(unescaped, "")

	// Remove Reddit-specific markers
	unescaped = strings.ReplaceAll(unescaped, "<!-- SC_OFF -->", "")
	unescaped = strings.ReplaceAll(unescaped, "<!-- SC_ON -->", "")

	// Remove HTML tags
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

func fetchFeed(ctx context.Context, feedURL string) (*RSSFeed, error) {
	// We'll need to:
	// 1. Create an HTTP request
	request, err := http.NewRequestWithContext(ctx, "GET", feedURL, nil)
	if err != nil {
		return nil, err
	}

	// Set headers that make the request appear more legitimate
	request.Header.Set("User-Agent", "Mozilla/5.0 (compatible; Gator RSS Reader/1.0; +https://github.com/user/gator)")
	request.Header.Set("Accept", "application/rss+xml, application/atom+xml, application/xml, text/xml, */*")
	request.Header.Set("Accept-Language", "en-US,en;q=0.9")
	request.Header.Set("Accept-Encoding", "gzip, deflate")
	request.Header.Set("Cache-Control", "no-cache")
	request.Header.Set("Connection", "keep-alive")

	client := &http.Client{Timeout: 30 * time.Second}
	// 2. Send the request
	response, err := client.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close() // Always close when done, but deferred to end of func

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

	// 3. Read the response
	body, err := io.ReadAll(reader) // need to read response.Body for the content of the response rather than headers / status codes etc
	if err != nil {
		return nil, err
	}
	// 4. Parse the XML - try RSS first, then Atom
	var feed RSSFeed
	err = xml.Unmarshal(body, &feed)
	if err != nil || feed.Channel.Title == "" {
		// If RSS parsing failed or didn't find channel, try Atom format
		var atomFeed AtomFeed
		err = xml.Unmarshal(body, &atomFeed)
		if err != nil {
			return nil, err
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

			// Use content or summary for description
			if entry.Content != "" {
				feed.Channel.Item[i].Description = entry.Content
			} else {
				feed.Channel.Item[i].Description = entry.Summary
			}

			// Use published or updated for date
			if entry.Published != "" {
				feed.Channel.Item[i].PubDate = entry.Published
			} else {
				feed.Channel.Item[i].PubDate = entry.Updated
			}
		}
	}

	feed.Channel.Title = html.UnescapeString(feed.Channel.Title)
	feed.Channel.Description = html.UnescapeString(feed.Channel.Description)
	for i := range feed.Channel.Item {
		feed.Channel.Item[i].Title = html.UnescapeString(feed.Channel.Item[i].Title)
		feed.Channel.Item[i].Description = cleanDescription(feed.Channel.Item[i].Description)
	}
	return &feed, nil
}

func HandlerAgg(s *State, cmd Command) error {
	if len(cmd.Args) < 1 || len(cmd.Args) > 2 {
		return fmt.Errorf("usage: %v <time_between_reqs>", cmd.Name)
	}

	timeBetweenRequests, err := time.ParseDuration(cmd.Args[0])
	if err != nil {
		return fmt.Errorf("invalid duration: %w", err)
	}
	log.Printf("Collecting feeds every %s...", timeBetweenRequests)

	ticker := time.NewTicker(timeBetweenRequests)

	for ; ; <-ticker.C {
		scrapeFeeds(s)
	}
}

func scrapeFeeds(s *State) {
	feed, err := s.Db.GetNextFeedToFetch(context.Background())
	if err != nil {
		log.Println("Couldn't get next feeds to fetch", err)
		return
	}
	log.Println("Found a feed to fetch!")
	scrapeFeed(s.Db, feed)
}

func scrapeFeed(db *database.Queries, feed database.Feed) {
	_, err := db.MarkFeedFetched(context.Background(), feed.ID)
	if err != nil {
		log.Printf("Couldn't mark feed %s fetched: %v", feed.Name, err)
		return
	}

	feedData, err := fetchFeed(context.Background(), feed.Url)
	if err != nil {
		log.Printf("Couldn't collect feed %s: %v", feed.Name, err)
		return
	}
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

		_, err = db.CreatePost(context.Background(), database.CreatePostParams{
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
				continue
			}
			log.Printf("Couldn't create post: %v", err)
			continue
		}
	}
	log.Printf("Feed %s collected, %v posts found", feed.Name, len(feedData.Channel.Item))
}

func HandlerAddFeed(s *State, cmd Command, user database.User) error {
	user, err := s.Db.GetUser(context.Background(), s.Cfg.CurrentUserName)
	if err != nil {
		return err
	}

	if len(cmd.Args) != 2 {
		return fmt.Errorf("| usage: %s <name> <url>", cmd.Name)
	}

	name := cmd.Args[0]
	url := cmd.Args[1]

	feed, err := s.Db.CreateFeed(context.Background(), database.CreateFeedParams{
		ID:        uuid.New(),
		CreatedAt: time.Now().UTC(),
		UpdatedAt: time.Now().UTC(),
		UserID:    user.ID,
		Name:      name,
		Url:       url,
	})
	if err != nil {
		return fmt.Errorf("couldn't create feed: %w", err)
	}

	id := uuid.New()
	now := time.Now()
	_, err = s.Db.CreateFeedFollow(context.Background(), database.CreateFeedFollowParams{
		ID:        id,
		CreatedAt: now,
		UpdatedAt: now,
		UserID:    user.ID,
		FeedID:    feed.ID,
	})
	if err != nil {
		return fmt.Errorf("failed to create feed follow: %w", err)
	}

	fmt.Println("Feed created successfully:")

	printFeed(feed)
	fmt.Println()
	fmt.Println("Feed Follow created successfully:")
	fmt.Println("===========================")
	return nil
}

func printFeed(feed database.Feed) {
	fmt.Printf("* ID:            %s\n", feed.ID)
	fmt.Printf("* Created:       %v\n", feed.CreatedAt)
	fmt.Printf("* Updated:       %v\n", feed.UpdatedAt)
	fmt.Printf("* Name:          %s\n", feed.Name)
	fmt.Printf("* URL:           %s\n", feed.Url)
	fmt.Printf("* UserID:        %s\n", feed.UserID)
}

func printFeedWithUser(feed database.GetAllFeedsRow) {
	fmt.Printf("* Name:          %s\n", feed.Name)
	fmt.Printf("* URL:           %s\n", feed.Url)
	fmt.Printf("* UserName:      %s\n", feed.Username)
}

func HandlerPrintAllFeeds(s *State, cmd Command) error {
	feeds, err := s.Db.GetAllFeeds(context.Background())
	if err != nil {
		return err
	}
	if len(feeds) == 0 {
		fmt.Println("No feeds found.")
		return nil
	}

	fmt.Printf("Found %d feeds:\n", len(feeds))
	for _, feed := range feeds {
		printFeedWithUser(feed)
	}
	return nil
}

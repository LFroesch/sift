package main

import (
	"database/sql"
	"log"

	"github.com/LFroesch/Gator/api"
	"github.com/LFroesch/Gator/internal/database"
	_ "github.com/lib/pq"
)

func main() {
	// Database connection
	dbURL := "postgres://postgres:postgres@localhost:5432/gator?sslmode=disable"
	db, err := sql.Open("postgres", dbURL)
	if err != nil {
		log.Fatalf("Failed to open db: %v", err)
	}
	defer db.Close()

	dbQueries := database.New(db)
	server := api.NewServer(dbQueries)

	log.Println("Starting API server on port 8080...")
	if err := server.Start("8080"); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
}

package handlers

import (
	"github.com/LFroesch/Gator/internal/config"
	"github.com/LFroesch/Gator/internal/database"
)

type State struct {
	Db  *database.Queries
	Cfg *config.Config
}

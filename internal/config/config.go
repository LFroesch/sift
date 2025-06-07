package config

import (
	"encoding/json"
	"os"
)

const configFileName = ".gatorconfig.json"

type Config struct {
	DBURL           string `json:"db_url"`
	CurrentUserName string `json:"current_user_name"`
}

func (cfg *Config) SetUser(userName string) error {
	cfg.CurrentUserName = userName
	return write(*cfg)
}

func getConfigFilePath() (string, error) {
	return configFileName, nil
}

func Read() (Config, error) {
	var cfg Config

	// get file path same as above / error check
	filePath, err := getConfigFilePath()
	if err != nil {
		return cfg, err
	}

	// open filepath to get file / error check
	file, err := os.Open(filePath)
	if err != nil {
		return cfg, err
	}
	// defer the file.close like above
	defer file.Close()

	// creates a new JSON decoder that reads from the file
	decoder := json.NewDecoder(file)

	//
	err = decoder.Decode(&cfg)

	return cfg, err
}

func write(cfg Config) error {
	fullPath, err := getConfigFilePath()
	if err != nil {
		return err
	}

	file, err := os.Create(fullPath)
	if err != nil {
		return err
	}
	defer file.Close()

	encoder := json.NewEncoder(file)
	err = encoder.Encode(cfg)
	if err != nil {
		return err
	}

	return nil
}

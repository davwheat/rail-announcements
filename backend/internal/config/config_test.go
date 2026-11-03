package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestAllowedOriginsMustBeOrigins(t *testing.T) {
	for origin, valid := range map[string]bool{
		"*":                                      true,
		"https://railannouncements.co.uk":        true,
		"https://*.rail-announcements.pages.dev": true,
		"http://*.localhost:3000":                true,
		"http://[::1]:3000":                      true,
		"*.rail-announcements.pages.dev":         false,
		"rail-announcements.pages.dev":           false,
		"https://railannouncements.co.uk/":       false,
		"https://railannouncements.co.uk/path":   false,
		"https://*":                              false,
		"https://*.":                             false,
		"https://a.*.pages.dev":                  false,
		"https://*.*.pages.dev":                  false,
		"https://*rail.pages.dev":                false,
		" https://railannouncements.co.uk":       false,
	} {
		path := filepath.Join(t.TempDir(), "config.toml")
		if err := os.WriteFile(path, []byte("[API]\nAllowedOrigins = [\""+origin+"\"]\n"), 0o600); err != nil {
			t.Fatal(err)
		}
		if _, err := Load(path); (err == nil) != valid {
			t.Errorf("%q: valid %t, got error %v", origin, valid, err)
		}
	}
}

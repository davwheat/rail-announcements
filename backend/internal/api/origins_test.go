package api

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestWildcardOriginsAllowSubdomainsOnly(t *testing.T) {
	allowed := parseOrigins([]string{
		"https://railannouncements.co.uk",
		"https://*.rail-announcements.pages.dev",
		"http://*.localhost:3000",
	})
	for origin, want := range map[string]bool{
		"https://railannouncements.co.uk":                       true,
		"https://abc123.rail-announcements.pages.dev":           true,
		"https://feat-streams.rail-announcements.pages.dev":     true,
		"https://a.b.rail-announcements.pages.dev":              true,
		"http://dev.localhost:3000":                             true,
		"https://rail-announcements.pages.dev":                  false,
		"https://.rail-announcements.pages.dev":                 false,
		"http://abc123.rail-announcements.pages.dev":            false,
		"https://abc123.rail-announcements.pages.dev:8443":      false,
		"https://evilrail-announcements.pages.dev":              false,
		"https://abc123.rail-announcements.pages.dev.evil.test": false,
		"https://evil.test/.rail-announcements.pages.dev":       false,
		"https://evil.test:1.rail-announcements.pages.dev":      false,
		"http://dev.localhost":                                  false,
		"https://www.railannouncements.co.uk":                   false,
	} {
		if got := allowed.allow(origin); got != want {
			t.Errorf("%s: allowed %t, want %t", origin, got, want)
		}
	}
}

func TestCORSEchoesAWildcardMatch(t *testing.T) {
	server := &Server{origins: parseOrigins([]string{"https://*.rail-announcements.pages.dev"})}
	handler := server.cors(http.NotFoundHandler())

	preflight := func(origin string) *http.Response {
		request := httptest.NewRequest(http.MethodOptions, "/v1/announcements", nil)
		request.Header.Set("Origin", origin)
		recorder := httptest.NewRecorder()
		handler.ServeHTTP(recorder, request)
		return recorder.Result()
	}

	const preview = "https://abc123.rail-announcements.pages.dev"
	allowed := preflight(preview)
	if allowed.StatusCode != http.StatusNoContent || allowed.Header.Get("Access-Control-Allow-Origin") != preview || allowed.Header.Get("Vary") != "Origin" {
		t.Errorf("preflight from %s: HTTP %d, allow-origin %q, vary %q", preview, allowed.StatusCode, allowed.Header.Get("Access-Control-Allow-Origin"), allowed.Header.Get("Vary"))
	}
	if refused := preflight("https://rail-announcements.pages.dev"); refused.Header.Get("Access-Control-Allow-Origin") != "" {
		t.Error("the wildcard's parent host was allowed")
	}
}

package fgwtrainfx

import (
	"testing"

	"rail-announcements-backend/internal/systems/paritytest"
)

func TestMatchesTheWebsite(t *testing.T) {
	sys, err := New()
	if err != nil {
		t.Fatal(err)
	}
	paritytest.Run(t, sys, "testdata/parity.json.gz")
}

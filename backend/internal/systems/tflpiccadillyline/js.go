package tflpiccadillyline

import (
	"strconv"
	"strings"
)

// jsParseInt reads an integer the way the website's parseInt does: leading
// digits count and anything after them is ignored, and a value with no leading
// digits is NaN. The announcement card's select values include "none", which
// parses to NaN and so matches no audio ID.
func jsParseInt(s string) (int, bool) {
	s = strings.TrimSpace(s)
	end := 0
	if end < len(s) && (s[end] == '+' || s[end] == '-') {
		end++
	}
	start := end
	for end < len(s) && s[end] >= '0' && s[end] <= '9' {
		end++
	}
	if end == start {
		return 0, false
	}
	n, err := strconv.Atoi(s[:end])
	return n, err == nil
}

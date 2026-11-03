package ketech

import (
	"strconv"
	"strings"
)

// jsParseInt reads an integer the way the website's parseInt does: leading
// digits count and anything after them is ignored, so platform "3b" is 3 and
// platform "a" is not a number. The announcements branch on exactly that.
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

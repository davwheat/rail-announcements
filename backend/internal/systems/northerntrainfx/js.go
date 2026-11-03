package northerntrainfx

import (
	"strconv"
	"strings"
)

// jsParseInt reads an integer the way the website's parseInt does: leading
// digits count and anything after them is ignored, so "7pm" is 7 and "noon" is
// not a number at all. The arrival time announcement branches on exactly that.
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

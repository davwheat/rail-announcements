package banedanmark

import (
	"encoding/json"
	"strconv"
	"strings"
)

// state is a tab's option object, held as the website posts it. Its fields are
// read one at a time so that a missing, null or oddly typed value reaches the
// announcement the way JavaScript would hand it over.
type state map[string]json.RawMessage

// text renders a field as a JavaScript template literal would splice it in, so
// a field that is absent reads "undefined" and one that is null reads "null".
func text(raw json.RawMessage) string {
	if len(raw) == 0 {
		return "undefined"
	}
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return string(raw)
	}
	switch value := value.(type) {
	case nil:
		return "null"
	case string:
		return value
	case bool:
		return strconv.FormatBool(value)
	case float64:
		return strconv.FormatFloat(value, 'f', -1, 64)
	}
	return string(raw)
}

// truthy tests a field the way an `if` in JavaScript would.
func truthy(raw json.RawMessage) bool {
	if len(raw) == 0 {
		return false
	}
	var value any
	if err := json.Unmarshal(raw, &value); err != nil {
		return false
	}
	switch value := value.(type) {
	case nil:
		return false
	case string:
		return value != ""
	case bool:
		return value
	case float64:
		return value != 0
	}
	return true
}

// isString reports whether a field is the string want, as JavaScript's `===`
// would: a number or a boolean never equals a string, whatever it spells.
func isString(raw json.RawMessage, want string) bool {
	var value string
	return json.Unmarshal(raw, &value) == nil && value == want
}

// jsNumber is the result of parseInt, which fails to NaN rather than to an
// error. The announcements splice the number straight into a clip ID, so the
// failure has to survive as far as the spelling "NaN".
type jsNumber struct {
	value int
	ok    bool
}

func (n jsNumber) String() string {
	if !n.ok {
		return "NaN"
	}
	return strconv.Itoa(n.value)
}

// jsParseInt reads an integer the way the website's parseInt does: leading
// digits count and anything after them is ignored, so "3b" is 3 and "a" is
// not a number.
func jsParseInt(s string) jsNumber {
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
		return jsNumber{}
	}
	value, err := strconv.Atoi(s[:end])
	return jsNumber{value: value, ok: err == nil}
}

// strings reads a field as an array of template-literal strings, dropping the
// falsy entries the way the website's `filter(Boolean)` does. Anything that is
// not an array yields nothing.
func (s state) strings(name string) []string {
	var items []json.RawMessage
	if err := json.Unmarshal(s[name], &items); err != nil {
		return nil
	}
	out := make([]string, 0, len(items))
	for _, item := range items {
		if truthy(item) {
			out = append(out, text(item))
		}
	}
	return out
}
